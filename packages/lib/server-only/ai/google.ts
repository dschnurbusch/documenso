import { createVertex } from '@ai-sdk/google-vertex';

import { env } from '../../utils/env';

const googleClientEmail = env('GOOGLE_CLIENT_EMAIL');
const googlePrivateKey = env('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
const googlePrivateKeyId = env('GOOGLE_PRIVATE_KEY_ID');
const googleVertexApiKey = env('GOOGLE_VERTEX_API_KEY');

export const vertex = createVertex({
  project: env('GOOGLE_VERTEX_PROJECT_ID'),
  location: env('GOOGLE_VERTEX_LOCATION') || 'global',
  ...(googleVertexApiKey
    ? { apiKey: googleVertexApiKey }
    : googleClientEmail && googlePrivateKey
      ? {
          googleAuthOptions: {
            credentials: {
              client_email: googleClientEmail,
              private_key: googlePrivateKey,
              private_key_id: googlePrivateKeyId,
            },
          },
        }
      : {}),
});
