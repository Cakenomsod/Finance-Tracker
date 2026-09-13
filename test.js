fetch('http://localhost:3000/api/line/link-token', { method: 'POST' }).then(async r => {
  console.log(r.status, await r.text());
}).catch(console.error);
