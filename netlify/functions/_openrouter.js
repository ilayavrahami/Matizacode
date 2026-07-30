// עוטפת אחידה לקריאה ל-OpenRouter, בשימוש כל פונקציות ה-AI באתר.
// מנסה קודם מודל חינמי ספציפי (איכותי ואמין יותר), ואם הוא לא זמין —
// נופלת אוטומטית ל-auto-router הכללי (openrouter/free). כך לא תלויים
// לגמרי במודל אחד שעלול להיעלם (בדיוק כמו שקרה עם DeepSeek בעבר).

const MODEL_CHAIN = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/free'
];

async function callOpenRouter(messages, { maxTokens = 200, temperature = 0.5, referer, title } = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const err = new Error('חסר משתנה סביבה OPENROUTER_API_KEY');
    err.statusCode = 500;
    throw err;
  }

  let lastErrorText = 'unknown error';
  for (const model of MODEL_CHAIN) {
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
          'HTTP-Referer': referer || 'https://matzia-site.netlify.app',
          'X-Title': title || 'Matzia'
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature })
      });

      if (!resp.ok) {
        lastErrorText = (await resp.text()).slice(0, 400);
        console.error('OpenRouter model failed, trying next', model, resp.status, lastErrorText);
        continue;
      }

      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content || !content.trim()) {
        lastErrorText = 'תשובה ריקה מהמודל';
        console.error('OpenRouter empty content, trying next', model);
        continue;
      }
      return content.trim();
    } catch (e) {
      lastErrorText = e.message;
      console.error('OpenRouter request threw, trying next', model, e.message);
    }
  }

  const err = new Error('כל מודלי ה-AI נכשלו: ' + lastErrorText);
  err.statusCode = 502;
  throw err;
}

module.exports = { callOpenRouter };
