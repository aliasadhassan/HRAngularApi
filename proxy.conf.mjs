import { existsSync, readFileSync } from 'node:fs';

const secretsFile = new URL('./proxy.secrets.json', import.meta.url);
const secrets = existsSync(secretsFile) ? JSON.parse(readFileSync(secretsFile, 'utf8')) : {};

const key = process.env.AZURE_TRANSLATOR_KEY || secrets.azureTranslatorKey || '';
const region = process.env.AZURE_TRANSLATOR_REGION || secrets.azureTranslatorRegion || 'eastus';

if (!key) {
  console.warn('[proxy] Azure Translator key not set: create proxy.secrets.json (see proxy.secrets.example.json)');
}

export default {
  '/azure-api': {
    target: 'https://api.cognitive.microsofttranslator.com',
    secure: true,
    changeOrigin: true,
    pathRewrite: { '^/azure-api': '' },
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Ocp-Apim-Subscription-Region': region
    }
  }
};
