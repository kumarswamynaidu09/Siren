import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

dotenv.config();

// Tool definitions for AI
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
      name: 'search_online_music',
      description: 'Discover online music metadata and search results from legitimate music sources.',
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

// Helper to query Apple Music / iTunes Public Search API (No key required)
async function searchOnlineCatalog(query: string) {
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=6`;
    const response = await fetch(itunesUrl, {
      headers: { Accept: 'application/json' },
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

// Built-in intelligent Offline Natural Language Intent Engine
function resolveSmartLocalIntent(message: string, tracks: any[], playlists: any[]) {
  const q = message.trim().toLowerCase();

  // Explicit online search
  if (
    q.startsWith('search online') ||
    q.startsWith('find online') ||
    q.includes('online') ||
    q.includes('on the web') ||
    q.includes('preview')
  ) {
    const cleanQuery = message
      .replace(/^(search|find|look up)\s+(online|on the web|on internet)\s+(for\s+)?/i, '')
      .replace(/\s+(online|on the web|on internet)$/i, '')
      .replace(/^(search|find)\s+/i, '')
      .trim();
    return {
      toolName: 'search_online_music',
      args: { query: cleanQuery || message },
      isOnline: true,
      query: cleanQuery || message,
    };
  }

  // Playback / Start track command
  if (
    q.startsWith('play ') ||
    q.startsWith('start ') ||
    q.startsWith('put on ') ||
    q.startsWith('listen to ') ||
    q.startsWith('queue ')
  ) {
    const songQuery = message
      .replace(/^(play|start|put on|listen to|queue)\s+/i, '')
      .replace(/^(song|track)\s+/i, '')
      .trim();

    if (
      !songQuery ||
      songQuery === 'something' ||
      songQuery === 'random' ||
      songQuery === 'music' ||
      songQuery === 'a song'
    ) {
      const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
      if (randomTrack) {
        return {
          toolName: 'play_local_track',
          args: { trackId: randomTrack.id },
          message: `Shuffling library: Playing "${randomTrack.title}" by ${randomTrack.artist}.`,
        };
      }
    }

    const match = tracks.find(
      (t) =>
        t.title.toLowerCase().includes(songQuery.toLowerCase()) ||
        t.artist.toLowerCase().includes(songQuery.toLowerCase()) ||
        t.name?.toLowerCase().includes(songQuery.toLowerCase())
    );

    if (match) {
      return {
        toolName: 'play_local_track',
        args: { trackId: match.id },
        message: `Playing "${match.title}" by ${match.artist}.`,
      };
    } else {
      // Fallback to online search if song is not in local device
      return {
        toolName: 'search_online_music',
        args: { query: songQuery },
        isOnline: true,
        query: songQuery,
      };
    }
  }

  // Shuffle command
  if (q.includes('shuffle') || q.includes('random') || q === 'play something') {
    const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
    if (randomTrack) {
      return {
        toolName: 'play_local_track',
        args: { trackId: randomTrack.id },
        message: `Shuffling library: Playing "${randomTrack.title}" by ${randomTrack.artist}.`,
      };
    }
  }

  // Top rotation tracks
  if (
    q.includes('rotation') ||
    q.includes('top track') ||
    q.includes('top song') ||
    q.includes('most played') ||
    q.includes('heavy rotation')
  ) {
    const period = q.includes('week') ? 'week' : q.includes('month') ? 'month' : 'all';
    return {
      toolName: 'get_rotation',
      args: { period, limit: 10 },
      message: 'Here are your top acoustic rotation tracks.',
    };
  }

  // Favorites
  if (q.includes('favorite') || q.includes('liked') || q.includes('starred')) {
    return {
      toolName: 'get_favorites',
      args: { limit: 20 },
      message: 'Here are your favorited songs.',
    };
  }

  // Recently added
  if (
    q.includes('recently added') ||
    q.includes('newest') ||
    q.includes('latest songs') ||
    q.includes('new songs')
  ) {
    return {
      toolName: 'get_recently_added',
      args: { limit: 10 },
      message: 'Showing your recently added songs.',
    };
  }

  // Recently played
  if (q.includes('recently played') || q.includes('history') || q.includes('last played')) {
    return {
      toolName: 'get_recently_played',
      args: { limit: 10 },
      message: 'Showing your recently played songs.',
    };
  }

  // Create playlist
  if (q.startsWith('create playlist') || q.startsWith('make playlist') || q.startsWith('new playlist')) {
    const name =
      message
        .replace(/^(create|make|new)\s+playlist\s+(called\s+|named\s+)?/i, '')
        .trim() || 'New Playlist';
    return {
      toolName: 'create_playlist',
      args: { name, description: 'Created with Siren AI' },
      message: `Created playlist "${name}".`,
    };
  }

  // Search local tracks
  const cleanSearch = message
    .replace(/^(search|find|show|lookup|look up)\s+(songs|tracks|music)?\s*(by|from|for)?\s*/i, '')
    .trim();

  const matched = tracks.filter(
    (t) =>
      t.title.toLowerCase().includes(cleanSearch.toLowerCase()) ||
      t.artist.toLowerCase().includes(cleanSearch.toLowerCase()) ||
      t.album?.toLowerCase().includes(cleanSearch.toLowerCase())
  );

  if (matched.length > 0) {
    return {
      toolName: 'search_local_music',
      args: { query: cleanSearch },
      message: `Found ${matched.length} song${matched.length > 1 ? 's' : ''} matching "${cleanSearch}".`,
    };
  }

  // Default: search online music catalog
  return {
    toolName: 'search_online_music',
    args: { query: cleanSearch || message },
    isOnline: true,
    query: cleanSearch || message,
  };
}

// Vite plugin for Siren AI API
function sirenApiPlugin(): Plugin {
  return {
    name: 'siren-api-server',
    configureServer(server) {
      const apiApp = express();
      apiApp.use(express.json({ limit: '10mb' }));

      apiApp.get('/api/siren-ai/status', (_req, res) => {
        const hasKey = Boolean(
          (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') ||
          (process.env.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY !== 'MY_MISTRAL_API_KEY')
        );
        res.json({ configured: hasKey, engine: hasKey ? 'cloud' : 'local-intelligent' });
      });

      apiApp.get('/api/siren-ai/online-search', async (req, res) => {
        const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        if (!query) {
          res.status(400).json({ error: 'Query parameter "q" is required.' });
          return;
        }
        const results = await searchOnlineCatalog(query);
        res.json({ results });
      });

      apiApp.post('/api/siren-ai', async (req, res) => {
        const { message, libraryContext, customApiKey } = req.body;

        if (!message || typeof message !== 'string') {
          res.status(400).json({ error: 'Message string is required.' });
          return;
        }

        const tracks = libraryContext?.tracks || [];
        const playlists = libraryContext?.playlists || [];
        const freellmKey = process.env.FREELLM_API_KEY || process.env.OPENAI_API_KEY;
        const mistralKey = process.env.MISTRAL_API_KEY;
        const activeKey = customApiKey || freellmKey || mistralKey;
        const geminiKey = process.env.GEMINI_API_KEY;

        // 1. If FreeLLM, OpenAI-compatible, or Mistral API key is configured
        if (activeKey && activeKey !== 'MY_MISTRAL_API_KEY' && activeKey !== 'MY_FREELLM_API_KEY') {
          try {
            const systemPrompt = `You are Siren, a personal local music assistant for an Android music player.
Your primary responsibility is to control the user's existing local music library.
Never invent songs, artists, albums, track IDs, URLs, or playback results.
Use tools whenever the request requires actual library information or action.
If a requested song does not exist locally, use search_online_music or state clearly that it is not in the local library.
Keep responses concise, polite, and music-focused.

Here is the current state of the user's local Siren library:
Total local tracks: ${tracks.length}
Tracks metadata summary:
${JSON.stringify(tracks.slice(0, 100), null, 2)}

User playlists summary:
${JSON.stringify(playlists, null, 2)}`;

            let endpointUrl = 'https://api.mistral.ai/v1/chat/completions';
            let modelName = 'mistral-small-latest';

            if (customApiKey || freellmKey) {
              const rawBase = process.env.FREELLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.freellmapi.com/v1';
              const cleanBase = rawBase.replace(/\/+$/, '');
              endpointUrl = cleanBase.endsWith('/chat/completions') ? cleanBase : `${cleanBase}/chat/completions`;
              modelName = process.env.FREELLM_MODEL || process.env.AI_MODEL || 'auto';
            }

            const aiResponse = await fetch(endpointUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${activeKey}`,
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

            if (aiResponse.ok) {
              const data = await aiResponse.json();
              const choice = data.choices?.[0];
              const assistantMsg = choice?.message;

              if (assistantMsg?.tool_calls && assistantMsg.tool_calls.length > 0) {
                const toolCall = assistantMsg.tool_calls[0];
                const fnName = toolCall.function?.name;
                let fnArgs: Record<string, any> = {};
                try {
                  fnArgs = JSON.parse(toolCall.function?.arguments || '{}');
                } catch {}

                if (fnName === 'search_online_music') {
                  const queryToSearch = fnArgs.query || message;
                  const onlineResults = await searchOnlineCatalog(queryToSearch);
                  res.json({
                    toolCall: {
                      name: 'search_online_music',
                      args: { query: queryToSearch },
                    },
                    onlineResults,
                    message:
                      onlineResults.length > 0
                        ? `Found ${onlineResults.length} online results for "${queryToSearch}".`
                        : "I couldn't find a usable online result.",
                  });
                  return;
                }

                res.json({
                  toolCall: { name: fnName, args: fnArgs },
                  message: assistantMsg.content || undefined,
                });
                return;
              }

              if (assistantMsg?.content) {
                res.json({ message: assistantMsg.content });
                return;
              }
            }
          } catch (err) {
            console.warn('AI provider fallback to local intent engine:', err);
          }
        }

        // 2. If Gemini API key is configured
        if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
            const geminiPrompt = `You are Siren, a local music assistant.
Library Tracks: ${JSON.stringify(tracks.slice(0, 50))}
User request: "${message}"
Respond with a helpful, concise music assistance message.`;

            const geminiRes = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: geminiPrompt }] }],
              }),
            });

            if (geminiRes.ok) {
              const gData = await geminiRes.json();
              const text = gData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                // Combine with local intent for exact actionable playback/filtering
                const localIntent = resolveSmartLocalIntent(message, tracks, playlists);
                if (localIntent.isOnline) {
                  const onlineResults = await searchOnlineCatalog(localIntent.query);
                  res.json({
                    toolCall: { name: 'search_online_music', args: { query: localIntent.query } },
                    onlineResults,
                    message: text,
                  });
                  return;
                }
                res.json({
                  toolCall: { name: localIntent.toolName, args: localIntent.args },
                  message: text,
                });
                return;
              }
            }
          } catch (err) {
            console.warn('Gemini API fallback to local intent engine:', err);
          }
        }

        // 3. Smart Offline / Local Intent Engine (Zero setup, Always Works!)
        const intent = resolveSmartLocalIntent(message, tracks, playlists);

        if (intent.isOnline) {
          const onlineResults = await searchOnlineCatalog(intent.query);
          res.json({
            toolCall: {
              name: 'search_online_music',
              args: { query: intent.query },
            },
            onlineResults,
            message:
              onlineResults.length > 0
                ? `Found ${onlineResults.length} online results for "${intent.query}".`
                : `No online tracks found for "${intent.query}".`,
          });
          return;
        }

        res.json({
          toolCall: {
            name: intent.toolName,
            args: intent.args,
          },
          message: intent.message,
        });
      });

      server.middlewares.use(apiApp);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), sirenApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
