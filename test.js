async function test() {
  const res = await fetch('https://autoapply-five.vercel.app/api/generate-answers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'assistant', customPrompt: 'Test message for Assistant' })
  });
  const data = await res.json();
  console.log(res.status, data);
}
test();
