async function test() {
  const res = await fetch('https://autoapply-five.vercel.app/api/generate-answers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'assistant', customPrompt: 'We are working with a global, premium FMCG brand' })
  });
  console.log('Status:', res.status);
  try {
    const data = await res.json();
    console.log('Data:', data);
  } catch (e) {
    console.log('Text:', await res.text());
  }
}
test();
