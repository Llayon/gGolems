import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors'

type MatchRecordInput = {
  mode: string
  won: boolean
  blueScore: number
  redScore: number
}

type PlayerMatchRecord = {
  id: string
  player_id: string
  mode: string
  result: 'win' | 'loss'
  blue_score: number
  red_score: number
  created_at: string
}

type MatchProgressUpdate = {
  matchesPlayed: number
  matchesWon: number
  xp: number
  credits: number
  recentMatch: PlayerMatchRecord | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getPublicKey() {
  return Deno.env.get('SB_PUBLISHABLE_KEY')
    ?? Deno.env.get('SUPABASE_ANON_KEY')
    ?? ''
}

function getAccessToken(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!authHeader) {
    throw new Error('Missing authorization header.')
  }

  const [bearer, token] = authHeader.split(' ')
  if (bearer !== 'Bearer' || !token) {
    throw new Error("Authorization header must be 'Bearer <token>'.")
  }

  return token
}

function validateMatchPayload(payload: unknown): MatchRecordInput {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Match payload must be an object.')
  }

  const raw = payload as Partial<MatchRecordInput>
  const mode = typeof raw.mode === 'string' ? raw.mode.trim().toLowerCase() : ''
  if (mode !== 'control' && mode !== 'tdm') {
    throw new Error('Mode must be control or tdm.')
  }

  if (typeof raw.won !== 'boolean') {
    throw new Error('won must be boolean.')
  }

  if (!Number.isInteger(raw.blueScore) || raw.blueScore! < 0) {
    throw new Error('blueScore must be a non-negative integer.')
  }

  if (!Number.isInteger(raw.redScore) || raw.redScore! < 0) {
    throw new Error('redScore must be a non-negative integer.')
  }

  return {
    mode,
    won: raw.won,
    blueScore: raw.blueScore,
    redScore: raw.redScore,
  }
}

function isMissingRelationError(error: unknown, relationName: string) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const code = 'code' in error ? (error as { code?: unknown }).code : undefined
  const message = 'message' in error ? (error as { message?: unknown }).message : undefined
  return code === '42P01'
    || code === 'PGRST204'
    || code === 'PGRST205'
    || (typeof message === 'string' && message.toLowerCase().includes(relationName.toLowerCase()))
}

function calculateRewards(result: MatchRecordInput) {
  return {
    xp: result.won ? 125 : 55,
    credits: result.won ? 60 : 25,
    outcome: result.won ? 'win' : 'loss' as const,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const publicKey = getPublicKey()
    if (!supabaseUrl || !publicKey) {
      return json({ error: 'Supabase function environment is missing project keys.' }, 500)
    }

    const accessToken = getAccessToken(req)
    const payload = validateMatchPayload(await req.json())
    const verifier = createClient(supabaseUrl, publicKey)
    const { data: claimsData, error: claimsError } = await verifier.auth.getClaims(accessToken)
    const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
    if (!userId || claimsError) {
      return json({ error: 'Invalid JWT.' }, 401)
    }

    const supabase = createClient(supabaseUrl, publicKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })

    const { data: existing, error: loadError } = await supabase
      .from('player_progress')
      .select('matches_played, matches_won, xp, credits')
      .eq('player_id', userId)
      .maybeSingle()

    if (loadError) {
      return json({ error: loadError.message }, 500)
    }

    const rewards = calculateRewards(payload)
    const now = new Date().toISOString()
    const matchesPlayed = (existing?.matches_played ?? 0) + 1
    const matchesWon = (existing?.matches_won ?? 0) + (payload.won ? 1 : 0)
    const xp = (existing?.xp ?? 0) + rewards.xp
    const credits = (existing?.credits ?? 0) + rewards.credits

    const { error: progressError } = await supabase.from('player_progress').upsert({
      player_id: userId,
      matches_played: matchesPlayed,
      matches_won: matchesWon,
      xp,
      credits,
      last_match_mode: payload.mode,
      last_match_result: rewards.outcome,
      last_match_blue: payload.blueScore,
      last_match_red: payload.redScore,
      updated_at: now,
    }, {
      onConflict: 'player_id',
    })

    if (progressError) {
      return json({ error: progressError.message }, 500)
    }

    let recentMatch: PlayerMatchRecord | null = null
    const { data: historyData, error: historyError } = await supabase
      .from('match_results')
      .insert({
        player_id: userId,
        mode: payload.mode,
        result: rewards.outcome,
        blue_score: payload.blueScore,
        red_score: payload.redScore,
      })
      .select('id, player_id, mode, result, blue_score, red_score, created_at')
      .single()

    if (historyError && !isMissingRelationError(historyError, 'match_results')) {
      return json({ error: historyError.message }, 500)
    }

    if (historyData) {
      recentMatch = historyData as PlayerMatchRecord
    }

    const response: MatchProgressUpdate = {
      matchesPlayed,
      matchesWon,
      xp,
      credits,
      recentMatch,
    }

    return json(response, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected finish-match failure.'
    return json({ error: message }, 400)
  }
})
