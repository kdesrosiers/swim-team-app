let _tokenCache = { accessToken: null, expiresAt: 0 };

function isCacheValid() {
  return (
    _tokenCache.accessToken !== null &&
    Date.now() < _tokenCache.expiresAt - 60_000
  );
}

function setCachedToken(accessToken, expiresIn) {
  _tokenCache = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

function clearCachedToken() {
  _tokenCache = { accessToken: null, expiresAt: 0 };
}

export function requestDriveToken() {
  if (isCacheValid()) return Promise.resolve(_tokenCache.accessToken);

  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return Promise.reject(new Error("REACT_APP_GOOGLE_CLIENT_ID is not configured."));
  }

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (response) => {
        if (response.error) {
          if (
            response.error === "access_denied" ||
            response.error === "popup_closed_by_user"
          ) {
            reject(Object.assign(new Error("cancelled"), { cancelled: true }));
          } else {
            reject(new Error(response.error_description || response.error));
          }
          return;
        }
        const expiresIn = parseInt(response.expires_in, 10) || 3600;
        setCachedToken(response.access_token, expiresIn);
        resolve(response.access_token);
      },
    });
    client.requestAccessToken({ prompt: "" });
  });
}

export async function uploadDocxToDrive({ accessToken, blob, name }, retried = false) {
  const metadata = {
    name,
    mimeType: "application/vnd.google-apps.document",
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", blob, name);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (res.status === 401 || res.status === 403) {
    if (retried) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        errBody?.error?.message ||
          `Drive authorization failed (${res.status}). Please try again.`
      );
    }
    clearCachedToken();
    const freshToken = await requestDriveToken();
    return uploadDocxToDrive({ accessToken: freshToken, blob, name }, true);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `Drive upload failed: ${res.status}`
    );
  }

  return res.json();
}
