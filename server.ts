import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Tool definitions for Mistral AI
const MISTRAL_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_local_music',
      description: 'Search actual local tracks by title, artist, album, or filename in the user\'s local Siren library.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to match against local track title, artist, album, or filename.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'play_local_track',
      description: 'Play a specific track from the user\'s local library. The trackId MUST correspond to a real track from the local library.',
      parameters: {
        type: 'object',
        properties: {
          trackId: {
            type: 'string',
            description: 'The exact ID of the local track to play.',
          },
        },
        required: ['trackId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rotation',
      description: 'Retrieve the user\'s top acoustic rotation tracks sorted by actual play count and last played date.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['all', 'month', 'week'],
            description: 'Time window for rotation ranking.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of tracks to return (e.g. 5, 10).',
          },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_favorites',
      description: 'Retrieve the user\'s favorited tracks from their local library.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of favorite tracks to return.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recently_added',
      description: 'Retrieve recently added tracks based on local addedAt timestamps.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of recently added tracks to return.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recently_played',
      description: 'Retrieve recently played tracks based on actual local lastPlayedAt timestamps.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of recently played tracks to return.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_playlist',
      description: 'Create a new playlist in the user\'s local database.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the playlist.',
          },
          description: {
            type: 'string',
            description: 'Description of the playlist.',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_tracks_to_playlist',
      description: 'Add existing local tracks to an existing playlist in the user\'s local database.',
      parameters: {
        type: 'object',
        properties: {
          playlistId: {
            type: 'string',
            description: 'The ID or name of the target playlist.',
          },
          trackIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of exact local track IDs to add.',
          },
        },
        required: ['playlistId', 'trackIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_online_music',
      description: 'Discover online music metadata and search results from legitimate music sources. Does not rip or download streams.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Song title and/or artist to search for online.',
          },
        },
        required: ['query'],
      },
    },
  },
];

// Helper to query legitimate online music catalogue (Apple Music / iTunes Search API)
async function searchOnlineCatalog(query: string) {
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=6`;
    const response = await fetch(itunesUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    return data.results.map((item: any) => ({
      title: item.trackName || 'Unknown Title',
      artist: item.artistName || 'Unknown Artist',
      album: item.collectionName || undefined,
      source: 'Apple Music / iTunes Store',
      url: item.trackViewUrl || '',
      previewUrl: item.previewUrl || undefined,
      artworkUrl: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '300x300bb') : undefined,
      playableStatus: item.previewUrl ? '30s official sample available' : 'Metadata catalog entry',
    }));
  } catch (err) {
    console.warn('Online catalog lookup warning:', err);
    return [];
  }
}

// Check Mistral API key status
app.get('/api/siren-ai/status', (_req, res) => {
  res.json({
    configured: Boolean(process.env.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY !== 'MY_MISTRAL_API_KEY'),
  });
});

// Endpoint for direct online search
app.get('/api/siren-ai/online-search', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query) {
    res.status(400).json({ error: 'Query parameter "q" is required.' });
    return;
  }
  const results = await searchOnlineCatalog(query);
  res.json({ results });
});

// Main Siren AI Intent Endpoint
app.post('/api/siren-ai', async (req, res) => {
  const { message, libraryContext } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message string is required.' });
    return;
  }

  const freellmKey = process.env.FREELLM_API_KEY || process.env.OPENAI_API_KEY;
  const mistralKey = process.env.MISTRAL_API_KEY;
  const apiKey = freellmKey || mistralKey;

  if (!apiKey || apiKey === 'MY_MISTRAL_API_KEY' || apiKey === 'MY_FREELLM_API_KEY') {
    res.json({
      error: "Siren AI isn't configured yet.",
      code: 'MISSING_API_KEY',
    });
    return;
  }

  try {
    const tracks = libraryContext?.tracks || [];
    const playlists = libraryContext?.playlists || [];

    // System prompt enforcing strict anti-hallucination and music assistant guidelines
    const systemPrompt = `You are Siren, a personal local music assistant for an Android music player.
Your primary responsibility is to control the user's existing local music library.
Never invent songs, artists, albums, track IDs, URLs, or playback results.
Use tools whenever the request requires actual library information or action.
If a requested song does not exist locally, say clearly that it is not in the local library.
If the user explicitly asks for an online search, use the search_online_music tool.
Never claim that an action succeeded until the application returns a successful tool result.
Keep responses concise, polite, and music-focused.

Here is the current state of the user's local Siren library:
Total local tracks: ${tracks.length}
Tracks metadata summary:
${JSON.stringify(tracks.slice(0, 100), null, 2)}

User playlists summary:
${JSON.stringify(playlists, null, 2)}`;

    let endpointUrl = 'https://api.mistral.ai/v1/chat/completions';
    let modelName = 'mistral-small-latest';

    if (freellmKey) {
      const rawBase = process.env.FREELLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.freellmapi.com/v1';
      const cleanBase = rawBase.replace(/\/+$/, '');
      endpointUrl = cleanBase.endsWith('/chat/completions') ? cleanBase : `${cleanBase}/chat/completions`;
      modelName = process.env.FREELLM_MODEL || process.env.AI_MODEL || 'auto';
    }

    const aiResponse = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        tools: MISTRAL_TOOLS,
        tool_choice: 'auto',
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      console.error('AI provider error response:', aiResponse.status, errBody);
      res.json({
        error: "Couldn't reach Siren AI. Your local library is still available.",
        code: 'API_ERROR',
      });
      return;
    }

    const data = await aiResponse.json();
    const choice = data.choices?.[0];
    const assistantMsg = choice?.message;

    if (!assistantMsg) {
      res.json({
        error: "Couldn't reach Siren AI. Your local library is still available.",
        code: 'API_ERROR',
      });
      return;
    }

    // Check for tool call
    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      const toolCall = assistantMsg.tool_calls[0];
      const fnName = toolCall.function?.name;
      let fnArgs: Record<string, any> = {};

      try {
        fnArgs = JSON.parse(toolCall.function?.arguments || '{}');
      } catch (err) {
        console.warn('Failed to parse tool call arguments:', err);
      }

      // If tool is search_online_music, resolve with official catalog data
      if (fnName === 'search_online_music') {
        const queryToSearch = fnArgs.query || message;
        const onlineResults = await searchOnlineCatalog(queryToSearch);
        res.json({
          toolCall: {
            name: 'search_online_music',
            args: { query: queryToSearch },
          },
          onlineResults,
          message: onlineResults.length > 0
            ? `Found ${onlineResults.length} online results for "${queryToSearch}".`
            : "I couldn't find a usable online result.",
        });
        return;
      }

      res.json({
        toolCall: {
          name: fnName,
          args: fnArgs,
        },
        message: assistantMsg.content || undefined,
      });
      return;
    }

    // Plain message response without tool call
    res.json({
      message: assistantMsg.content || '',
    });
  } catch (err) {
    console.error('Siren AI endpoint exception:', err);
    res.json({
      error: "Couldn't reach Siren AI. Your local library is still available.",
      code: 'API_ERROR',
    });
  }
});

// Full-stack Vite / Static integration
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIREN Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
