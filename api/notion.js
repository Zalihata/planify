// api/notion.js — Proxy Notion API
// Variables d'env requises : NOTION_TOKEN

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function notionHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ error: 'NOTION_TOKEN not configured' });

  const { action, ...payload } = req.body || {};

  try {

    // ── DIAGNOSTICS ──────────────────────────────────────────────────────────
    // Crée un diagnostic + met à jour la matière (remplace le webhook Make)
    // Payload : matiere_name, matieres_db_id, diagnostics_db_id, chapitres_db_id?,
    //           date, label, s1-s5, d1-d5, priorites, commentaire, chapitres_data?
    if (action === 'create_diagnostic') {
      const { matiere_name, matieres_db_id, diagnostics_db_id, chapitres_db_id,
              date, label, s1, s2, s3, s4, s5,
              priorites, commentaire, chapitres_data } = payload;

      // 1. Trouve la matière par nom
      const matQuery = await fetch(`${NOTION_API}/databases/${matieres_db_id}/query`, {
        method: 'POST', headers: notionHeaders(token),
        body: JSON.stringify({ filter: { property: 'Matiere', title: { equals: matiere_name } }, page_size: 1 })
      });
      const matData = await matQuery.json();
      const matPage = (matData.results || [])[0];
      if (!matPage) return res.status(404).json({ error: `Matière "${matiere_name}" introuvable` });
      const matiereId = matPage.id;

      // 2. Crée l'entrée Diagnostic
      const scores = [s1, s2, s3, s4, s5].map(s => Number(s) || 0);
      const scoreProps = {};
      scores.forEach((s, i) => { if (s > 0) scoreProps[`Score ${i + 1}`] = { number: s }; });

      const diagR = await fetch(`${NOTION_API}/pages`, {
        method: 'POST', headers: notionHeaders(token),
        body: JSON.stringify({
          parent: { database_id: diagnostics_db_id },
          properties: {
            'Name': { title: [{ text: { content: label || `Diagnostic ${matiere_name} — ${date}` } }] },
            'Date': { date: { start: date } },
            'Matiere': { relation: [{ id: matiereId }] },
            'Priorites': { rich_text: [{ text: { content: (priorites || '').substring(0, 2000) } }] },
            ...scoreProps
          }
        })
      });
      const diagData = await diagR.json();
      if (!diagR.ok) return res.status(diagR.status).json(diagData);

      // 3. Met à jour la Matière (score global + statut)
      const nonZero = scores.filter(s => s > 0);
      const avg = nonZero.length ? Math.round((nonZero.reduce((a, b) => a + b, 0) / nonZero.length) * 10) / 10 : 0;
      await fetch(`${NOTION_API}/pages/${matiereId}`, {
        method: 'PATCH', headers: notionHeaders(token),
        body: JSON.stringify({
          properties: {
            'Score global': { number: avg },
            'Statut diagnostic': { select: { name: 'Fait' } },
            'Derniere mise a jour': { date: { start: date } }
          }
        })
      });

      // 4. Met à jour les chapitres (optionnel)
      if (chapitres_db_id && Array.isArray(chapitres_data) && chapitres_data.length > 0) {
        const chapQuery = await fetch(`${NOTION_API}/databases/${chapitres_db_id}/query`, {
          method: 'POST', headers: notionHeaders(token),
          body: JSON.stringify({ filter: { property: 'Matiere', relation: { contains: matiereId } }, page_size: 100 })
        });
        const chapData = await chapQuery.json();
        const existing = (chapData.results || []).map(p => ({
          id: p.id,
          nom: p.properties['Chapitre']?.rich_text?.[0]?.plain_text || p.properties['Chapitre']?.title?.[0]?.plain_text || ''
        }));
        for (const ch of chapitres_data) {
          const found = existing.find(e => e.nom === ch.nom);
          if (found) {
            await fetch(`${NOTION_API}/pages/${found.id}`, {
              method: 'PATCH', headers: notionHeaders(token),
              body: JSON.stringify({ properties: { 'Urgence': { select: { name: ch.urgence || 'normale' } }, 'Couverture': { select: { name: ch.couverture || 'non' } } } })
            });
          } else {
            await fetch(`${NOTION_API}/pages`, {
              method: 'POST', headers: notionHeaders(token),
              body: JSON.stringify({ parent: { database_id: chapitres_db_id }, properties: { 'Chapitre': { title: [{ text: { content: ch.nom } }] }, 'Matiere': { relation: [{ id: matiereId }] }, 'Urgence': { select: { name: ch.urgence || 'normale' } }, 'Couverture': { select: { name: ch.couverture || 'non' } } } })
            });
          }
        }
      }
      return res.status(200).json({ success: true, diagnostic_id: diagData.id, matiere_id: matiereId, score_global: avg });
    }

    // ── WORKSPACE SETUP (à venir — Phase 2) ──────────────────────────────────
    // Créera automatiquement les bases Notion pour un nouvel utilisateur
    // en fonction de son profil planificateur.
    if (action === 'create_workspace') {
      return res.status(501).json({ error: 'create_workspace not yet implemented — coming in Phase 2' });
    }

    // ── PLANNING (bases pour la Phase 3) ─────────────────────────────────────
    if (action === 'get_tasks') {
      const r = await fetch(`${NOTION_API}/databases/${payload.database_id}/query`, {
        method: 'POST', headers: notionHeaders(token),
        body: JSON.stringify({ filter: payload.filter || {}, sorts: payload.sorts || [], page_size: payload.page_size || 50 })
      });
      return res.status(r.status).json(await r.json());
    }

    if (action === 'create_page') {
      const r = await fetch(`${NOTION_API}/pages`, {
        method: 'POST', headers: notionHeaders(token),
        body: JSON.stringify({ parent: { database_id: payload.database_id }, properties: payload.properties })
      });
      return res.status(r.status).json(await r.json());
    }

    if (action === 'patch_page') {
      const r = await fetch(`${NOTION_API}/pages/${payload.page_id}`, {
        method: 'PATCH', headers: notionHeaders(token),
        body: JSON.stringify({ properties: payload.properties })
      });
      return res.status(r.status).json(await r.json());
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('Notion proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
