import fetch from 'node-fetch';

async function testEndpoint() {
  console.log('Testing PUT /api/users/:userId endpoint');
  
  try {
    const response = await fetch('http://localhost:5000/api/users/507f1f77bcf86cd799439011', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ exportDirectory: 'C:\\Users\\Test\\Desktop' })
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testEndpoint();
