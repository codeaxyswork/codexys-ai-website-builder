async function testLocalApi() {
  try {
    const res = await fetch("http://localhost:3000/api/websites");
    console.log("API Status:", res.status);
    const json = await res.json();
    console.log("API Response:", json);
  } catch (err) {
    console.error("API Error:", err);
  }
}

testLocalApi();
