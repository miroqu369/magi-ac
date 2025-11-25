import { GoogleAuth } from 'google-auth-library';

const MAGI_STG_URL = process.env.MAGI_STG_URL || 'https://magi-stg-dtrah63zyq-an.a.run.app';
const auth = new GoogleAuth();

// Identity Token取得
async function getIdToken() {
  try {
    const client = await auth.getIdTokenClient(MAGI_STG_URL);
    const idToken = await client.idTokenProvider.fetchIdToken(MAGI_STG_URL);
    return idToken;
  } catch (error) {
    console.error('Failed to get ID token:', error.message);
    return null;
  }
}

// 仕様書取得
export async function fetchSpecification(category) {
  try {
    const token = await getIdToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${MAGI_STG_URL}/api/spec/${category}`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch spec: ${response.status}`);
    }

    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error(`Failed to fetch specification ${category}:`, error.message);
    return null;
  }
}

// 起動時に仕様書をキャッシュ
export async function loadSpecifications() {
  console.log('📚 Loading specifications from magi-stg...');
  
  const specs = {
    systemOverview: await fetchSpecification('system-overview.md'),
    magiAcSpec: await fetchSpecification('magi-ac-spec.md'),
    aiModels: await fetchSpecification('ai-models-config.json')
  };

  // JSON文字列をパース
  if (specs.aiModels) {
    try {
      specs.aiModels = JSON.parse(specs.aiModels);
    } catch (e) {
      console.error('Failed to parse AI models config:', e.message);
    }
  }

  const loaded = Object.values(specs).filter(s => s !== null).length;
  console.log(`✅ Loaded ${loaded}/3 specifications`);

  return specs;
}

// AIプロンプトに仕様書を挿入
export function enhancePromptWithSpec(prompt, specs) {
  if (!specs || !specs.magiAcSpec) {
    return prompt;
  }

  const specContext = `
# MAGI Analytics Center Context (Reference Only - Do not repeat this in your response)

You are part of the MAGI Analytics Center. Here are the official specifications:

${specs.magiAcSpec}

Your role and parameters are defined above. Please provide your analysis according to your designated role.

---

# Analysis Request:
${prompt}
`;

  return specContext;
}
