const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function h(token) {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Notion-Version': NOTION_VERSION };
}

async function nFetch(url, options) {
  const r = await fetch(url, options);
  const d = await r.json();
  return { ok: r.ok, status: r.status, data: d };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ error: 'NOTION_TOKEN not configured' });

  const { action, ...p } = req.body || {};

  try {

    // ── EXISTING ACTIONS (Bac project) ────────────────────────────────────────

    if (action === 'get_matieres') {
      const r = await fetch(`${NOTION_API}/databases/${p.database_id}/query`, { method:'POST', headers:h(token), body: JSON.stringify({ sorts:[{property:'Date épreuve',direction:'ascending'}] }) });
      return res.status(r.status).json(await r.json());
    }
    if (action === 'get_diagnostics') {
      const r = await fetch(`${NOTION_API}/databases/${p.database_id}/query`, { method:'POST', headers:h(token), body: JSON.stringify({ sorts:[{property:'Date',direction:'descending'}] }) });
      return res.status(r.status).json(await r.json());
    }
    if (action === 'get_planning') {
      let all=[], cursor, safety=10;
      do {
        const body={filter:{and:[{property:'Statut',select:{does_not_equal:'Annulé'}},{property:'Statut',select:{does_not_equal:'Fait'}},{property:'Statut',select:{does_not_equal:'En pause'}}]},sorts:[{property:'Date',direction:'ascending'}],page_size:100};
        if(cursor)body.start_cursor=cursor;
        const r=await fetch(`${NOTION_API}/databases/${p.database_id}/query`,{method:'POST',headers:h(token),body:JSON.stringify(body)});
        if(!r.ok)break;
        const d=await r.json();all=all.concat(d.results||[]);cursor=d.has_more?d.next_cursor:undefined;
      } while(cursor&&--safety>0);
      return res.status(200).json({results:all,has_more:false});
    }
    if (action === 'get_paused_sessions') {
      const r = await fetch(`${NOTION_API}/databases/${p.database_id}/query`, { method:'POST', headers:h(token), body: JSON.stringify({filter:{property:'Statut',select:{equals:'En pause'}},sorts:[{property:'Date',direction:'ascending'}]}) });
      return res.status(r.status).json(await r.json());
    }
    if (action === 'get_checkins') {
      const r = await fetch(`${NOTION_API}/databases/${p.database_id}/query`, { method:'POST', headers:h(token), body: JSON.stringify({sorts:[{property:'Jour',direction:'descending'}],page_size:p.limit||14}) });
      return res.status(r.status).json(await r.json());
    }
    if (action === 'create_checkin') {
      const r = await fetch(`${NOTION_API}/pages`, { method:'POST', headers:h(token), body: JSON.stringify({ parent:{database_id:p.database_id}, properties:{ 'Date':{title:[{text:{content:p.label}}]}, 'Jour':{date:{start:p.date}}, 'Moment':{select:{name:p.moment}}, 'Energie':{select:{name:p.energie}}, 'Sessions faites':{number:p.sessions_faites||0}, 'Ressenti':{select:{name:p.ressenti}}, ...(p.blocage?{'Blocage':{rich_text:[{text:{content:p.blocage}}]}}:{}) } }) });
      return res.status(r.status).json(await r.json());
    }
    if (action === 'update_session') {
      const props={};
      if(p.statut)props['Statut']={select:{name:p.statut}};
      if(p.completee_le)props['Complétée le']={date:{start:p.completee_le}};
      if(p.new_date)props['Date']={date:{start:p.new_date}};
      const r=await fetch(`${NOTION_API}/pages/${p.page_id}`,{method:'PATCH',headers:h(token),body:JSON.stringify({properties:props})});
      return res.status(r.status).json(await r.json());
    }
    if (action === 'reschedule_sessions') {
      const results=[];
      for(const c of p.changes){const props={};if(c.new_date)props['Date']={date:{start:c.new_date}};if(c.statut)props['Statut']={select:{name:c.statut}};const r=await fetch(`${NOTION_API}/pages/${c.page_id}`,{method:'PATCH',headers:h(token),body:JSON.stringify({properties:props})});results.push(await r.json());}
      return res.status(200).json({updated:results.length,results});
    }
    if (action === 'create_sessions') {
      const results=[];
      for(const s of p.sessions){const r=await fetch(`${NOTION_API}/pages`,{method:'POST',headers:h(token),body:JSON.stringify({parent:{database_id:p.database_id},properties:{'Session':{title:[{text:{content:s.titre}}]},'Date':{date:{start:s.date}},'Duree min':{number:s.duree},'Type':{select:{name:s.type}},'Statut':{select:{name:s.statut||'À faire'}},'Urgence':{select:{name:s.urgence||'normale'}},'Optionnel':{checkbox:s.optionnel||false},...(s.matiere?{'Matière':{select:{name:s.matiere}}}:{}),...(s.notes?{'Notes':{rich_text:[{text:{content:s.notes}}]}}:{})}})});results.push(await r.json());}
      return res.status(200).json({created:results.length,results});
    }
    if (action === 'get_reserve') {
      const r=await fetch(`${NOTION_API}/databases/${p.database_id}/query`,{method:'POST',headers:h(token),body:JSON.stringify({filter:{property:'Statut',select:{equals:'Disponible'}},sorts:[{property:'Urgence',direction:'ascending'}]})});
      return res.status(r.status).json(await r.json());
    }
    if (action === 'get_chapitres') {
      const r=await fetch(`${NOTION_API}/databases/${p.database_id}/query`,{method:'POST',headers:h(token),body:JSON.stringify({sorts:[{property:'Urgence',direction:'ascending'}],page_size:100})});
      return res.status(r.status).json(await r.json());
    }
    if (action === 'patch_page') {
      const r=await fetch(`${NOTION_API}/pages/${p.page_id}`,{method:'PATCH',headers:h(token),body:JSON.stringify({properties:p.properties||{}})});
      return res.status(r.status).json(await r.json());
    }
    if (action === 'purge_planning') {
      let allIds=[],cursor,safety=10;
      do{const body={page_size:100};if(cursor)body.start_cursor=cursor;const r=await fetch(`${NOTION_API}/databases/${p.database_id}/query`,{method:'POST',headers:h(token),body:JSON.stringify(body)});if(!r.ok)break;const d=await r.json();allIds=allIds.concat((d.results||[]).map(x=>x.id));cursor=d.has_more?d.next_cursor:undefined;}while(cursor&&--safety>0);
      for(let i=0;i<allIds.length;i+=10){await Promise.all(allIds.slice(i,i+10).map(id=>fetch(`${NOTION_API}/pages/${id}`,{method:'PATCH',headers:h(token),body:JSON.stringify({archived:true})})));if(i+10<allIds.length)await new Promise(r=>setTimeout(r,300));}
      return res.status(200).json({deleted:allIds.length});
    }

    // ── CREATE DIAGNOSTIC (remplace webhook Make) ─────────────────────────────

    if (action === 'create_diagnostic') {
      const { matiere_name, matieres_db_id, diagnostics_db_id, chapitres_db_id, date, label, s1,s2,s3,s4,s5, priorites, chapitres_data } = p;
      const mq=await fetch(`${NOTION_API}/databases/${matieres_db_id}/query`,{method:'POST',headers:h(token),body:JSON.stringify({filter:{property:'Matiere',title:{equals:matiere_name}},page_size:1})});
      const md=await mq.json();const mp=(md.results||[])[0];
      if(!mp)return res.status(404).json({error:`Matière "${matiere_name}" introuvable`});
      const matiereId=mp.id;
      const scores=[s1,s2,s3,s4,s5].map(s=>Number(s)||0);
      const sp={};scores.forEach((s,i)=>{if(s>0)sp[`Score ${i+1}`]={number:s};});
      const dr=await fetch(`${NOTION_API}/pages`,{method:'POST',headers:h(token),body:JSON.stringify({parent:{database_id:diagnostics_db_id},properties:{'Name':{title:[{text:{content:label||`Diagnostic ${matiere_name}`}}]},'Date':{date:{start:date}},'Matiere':{relation:[{id:matiereId}]},'Priorites':{rich_text:[{text:{content:(priorites||'').substring(0,2000)}}]},...sp}})});
      const dd=await dr.json();if(!dr.ok)return res.status(dr.status).json(dd);
      const nonZero=scores.filter(s=>s>0);const avg=nonZero.length?Math.round(nonZero.reduce((a,b)=>a+b,0)/nonZero.length*10)/10:0;
      await fetch(`${NOTION_API}/pages/${matiereId}`,{method:'PATCH',headers:h(token),body:JSON.stringify({properties:{'Score global':{number:avg},'Statut diagnostic':{select:{name:'Fait'}},'Derniere mise a jour':{date:{start:date}}}})});
      if(chapitres_db_id&&Array.isArray(chapitres_data)&&chapitres_data.length){const cq=await fetch(`${NOTION_API}/databases/${chapitres_db_id}/query`,{method:'POST',headers:h(token),body:JSON.stringify({filter:{property:'Matiere',relation:{contains:matiereId}},page_size:100})});const cd=await cq.json();const ex=(cd.results||[]).map(x=>({id:x.id,nom:x.properties['Chapitre']?.rich_text?.[0]?.plain_text||x.properties['Chapitre']?.title?.[0]?.plain_text||''}));for(const ch of chapitres_data){const found=ex.find(e=>e.nom===ch.nom);if(found){await fetch(`${NOTION_API}/pages/${found.id}`,{method:'PATCH',headers:h(token),body:JSON.stringify({properties:{'Urgence':{select:{name:ch.urgence||'normale'}},'Couverture':{select:{name:ch.couverture||'non'}}}})});}else{await fetch(`${NOTION_API}/pages`,{method:'POST',headers:h(token),body:JSON.stringify({parent:{database_id:chapitres_db_id},properties:{'Chapitre':{title:[{text:{content:ch.nom}}]},'Matiere':{relation:[{id:matiereId}]},'Urgence':{select:{name:ch.urgence||'normale'}},'Couverture':{select:{name:ch.couverture||'non'}}}})});}}}
      return res.status(200).json({success:true,diagnostic_id:dd.id,matiere_id:matiereId,score_global:avg});
    }

    // ── CREATE WORKSPACE (Phase 2 — Planify) ──────────────────────────────────
    // Crée automatiquement l'espace Notion d'un utilisateur :
    //   1 page principale  →  3 bases (Projets, Tâches, Check-ins)  →  projets initiaux
    // Nécessite : NOTION_PARENT_PAGE_ID dans les variables d'env Vercel
    // Payload : user_name, projects:[{name,context,deadline}], lang

    if (action === 'create_workspace') {
      const parentId = process.env.NOTION_PARENT_PAGE_ID;
      if (!parentId) return res.status(500).json({ error: 'NOTION_PARENT_PAGE_ID not configured in Vercel env vars' });

      const { user_name, projects = [], lang: wl = 'fr' } = p;
      const isFR = wl === 'fr';
      const appUrl = process.env.APP_URL || 'https://planify-pink-theta.vercel.app';
      const clean = id => id.replace(/-/g,'');

      // 1 — Page principale
      const pg = await nFetch(`${NOTION_API}/pages`, { method:'POST', headers:h(token), body: JSON.stringify({ parent:{type:'page_id',page_id:parentId}, icon:{type:'emoji',emoji:'🧭'}, properties:{ title:[{type:'text',text:{content:`${user_name} — Planify`}}] } }) });
      if (!pg.ok) return res.status(pg.status).json({ error:'Failed to create page', details:pg.data });
      const pageId = pg.data.id;

      // 2 — Base Projets (Contexte = multi_select pour couvrir plusieurs catégories)
      const ctxOpts = isFR
        ? [{name:'Professionnel',color:'blue'},{name:'Famille',color:'orange'},{name:'Associatif',color:'green'},{name:'Personnel',color:'purple'},{name:'Formation',color:'yellow'}]
        : [{name:'Professional',color:'blue'},{name:'Family',color:'orange'},{name:'Community',color:'green'},{name:'Personal',color:'purple'},{name:'Learning',color:'yellow'}];
      const projDB = await nFetch(`${NOTION_API}/databases`, { method:'POST', headers:h(token), body: JSON.stringify({
        parent:{type:'page_id',page_id:pageId}, icon:{type:'emoji',emoji:'📋'},
        title:[{type:'text',text:{content:isFR?'Projets':'Projects'}}],
        properties:{
          [isFR?'Nom':'Name']:{title:{}},
          'Contexte':{multi_select:{options:ctxOpts}},
          'Statut':{select:{options:[{name:isFR?'Idée':'Idea',color:'gray'},{name:isFR?'En cours':'In progress',color:'blue'},{name:isFR?'En pause':'On hold',color:'yellow'},{name:isFR?'Terminé':'Completed',color:'green'}]}},
          [isFR?'Début':'Start']:{date:{}},
          'Deadline':{date:{}},
          [isFR?'Priorité':'Priority']:{select:{options:[{name:isFR?'Critique':'Critical',color:'red'},{name:isFR?'Importante':'Important',color:'orange'},{name:isFR?'Secondaire':'Secondary',color:'gray'}]}},
          [isFR?'Description':'Description']:{rich_text:{}}
        }
      }) });
      if (!projDB.ok) return res.status(projDB.status).json({ error:'Failed to create Projets DB', details:projDB.data });
      const projDbId = projDB.data.id;

      // 3 — Base Tâches
      const tachesDB = await nFetch(`${NOTION_API}/databases`, { method:'POST', headers:h(token), body: JSON.stringify({
        parent:{type:'page_id',page_id:pageId}, icon:{type:'emoji',emoji:'✅'},
        title:[{type:'text',text:{content:isFR?'Tâches':'Tasks'}}],
        properties:{
          [isFR?'Titre':'Title']:{title:{}},
          [isFR?'Projet':'Project']:{relation:{database_id:projDbId,single_property:{}}},
          'Statut':{select:{options:[{name:isFR?'À faire':'To do',color:'gray'},{name:isFR?'En cours':'In progress',color:'blue'},{name:isFR?'Fait':'Done',color:'green'},{name:isFR?'Reporté':'Postponed',color:'yellow'}]}},
          'Date':{date:{}},
          [isFR?'Énergie requise':'Required energy']:{select:{options:[{name:'🔴 '+(isFR?'Haute':'High'),color:'red'},{name:'🟡 '+(isFR?'Moyenne':'Medium'),color:'yellow'},{name:'🟢 '+(isFR?'Basse':'Low'),color:'green'}]}},
          [isFR?'Notes':'Notes']:{rich_text:{}}
        }
      }) });
      if (!tachesDB.ok) return res.status(tachesDB.status).json({ error:'Failed to create Tâches DB', details:tachesDB.data });
      const tachesDbId = tachesDB.data.id;

      // 4 — Base Check-ins
      const ciDB = await nFetch(`${NOTION_API}/databases`, { method:'POST', headers:h(token), body: JSON.stringify({
        parent:{type:'page_id',page_id:pageId}, icon:{type:'emoji',emoji:'🌅'},
        title:[{type:'text',text:{content:'Check-ins'}}],
        properties:{
          [isFR?'Titre':'Title']:{title:{}},
          'Date':{date:{}},
          'Moment':{select:{options:[{name:isFR?'Matin':'Morning',color:'yellow'},{name:isFR?'Soir':'Evening',color:'blue'},{name:isFR?'Complet':'Complete',color:'green'}]}},
          [isFR?'Énergie':'Energy']:{select:{options:[{name:'1 — '+(isFR?'Épuisé·e':'Exhausted'),color:'red'},{name:'2 — '+(isFR?'Fatigué·e':'Tired'),color:'orange'},{name:'3 — '+(isFR?'Correct·e':'Okay'),color:'yellow'},{name:'4 — '+(isFR?'Bon·ne':'Good'),color:'blue'},{name:'5 — '+(isFR?'Excellent·e':'Excellent'),color:'green'}]}},
          [isFR?'Tâches prévues':'Planned tasks']:{rich_text:{}},
          [isFR?'Tâches faites':'Tasks done']:{number:{format:'number'}},
          [isFR?'Ressenti':'Feeling']:{select:{options:[{name:isFR?'Bien':'Good',color:'green'},{name:isFR?'Motivé·e':'Motivated',color:'blue'},{name:isFR?'Fatigué·e':'Tired',color:'orange'},{name:isFR?'Difficile':'Difficult',color:'red'},{name:isFR?'Stressé·e':'Stressed',color:'yellow'},{name:isFR?'Neutre':'Neutral',color:'gray'}]}},
          [isFR?'Notes':'Notes']:{rich_text:{}}
        }
      }) });
      if (!ciDB.ok) return res.status(ciDB.status).json({ error:'Failed to create Check-ins DB', details:ciDB.data });
      const ciDbId = ciDB.data.id;

      // 5 — Projets + tâches initiales
      const ctxMap = {pro:isFR?'Professionnel':'Professional',family:isFR?'Famille':'Family',asso:isFR?'Associatif':'Community',biz:isFR?'Professionnel':'Professional',learning:isFR?'Formation':'Learning',other:isFR?'Personnel':'Personal'};
      const projPageMap = {}; // name → page_id pour lier les tâches
      for (const proj of (projects||[]).slice(0,10)) {
        if (!proj.name?.trim()) continue;
        const ctxNames = ((proj.contexts&&proj.contexts.length)?proj.contexts:[proj.context||'other']).map(c=>ctxMap[c]).filter(Boolean);
        const pr = await nFetch(`${NOTION_API}/pages`, { method:'POST', headers:h(token), body: JSON.stringify({
          parent:{database_id:projDbId},
          properties:{
            [isFR?'Nom':'Name']:{title:[{text:{content:proj.name.trim()}}]},
            'Contexte':{multi_select:ctxNames.map(n=>({name:n}))},
            'Statut':{select:{name:isFR?'En cours':'In progress'}},
            ...(proj.deadline?{Deadline:{date:{start:proj.deadline}}}:{})
          }
        }) });
        if (pr.ok) projPageMap[proj.name.trim()] = pr.data.id;
        // Tâches initiales liées à ce projet
        for (const taskName of (proj.tasks||[]).filter(t=>t&&t.trim())) {
          const projPageId = projPageMap[proj.name.trim()];
          await nFetch(`${NOTION_API}/pages`, { method:'POST', headers:h(token), body: JSON.stringify({
            parent:{database_id:tachesDbId},
            properties:{
              [isFR?'Titre':'Title']:{title:[{text:{content:taskName.trim()}}]},
              'Statut':{select:{name:isFR?'À faire':'To do'}},
              ...(projPageId?{[isFR?'Projet':'Project']:{relation:[{id:projPageId}]}}:{})
            }
          }) });
        }
      }

      // 6 — Daily URL
      const dailyUrl = `${appUrl}/daily.html?n=${encodeURIComponent(user_name)}&ci=${ciDbId}&t=${tachesDbId}&p=${projDbId}&lang=${wl}`;

      // 7 — Tableau de bord avec embed check-in + liens
      const viewsNote = isFR
        ? '💡 Pour les vues : dans "Tâches" → + Ajouter une vue → Calendrier (vue quotidienne/hebdomadaire). Dans "Projets" → + Ajouter une vue → Timeline (vue mensuelle/trimestrielle).'
        : '💡 For views: in "Tasks" → + Add view → Calendar (daily/weekly). In "Projects" → + Add view → Timeline (monthly/quarterly).';
      const dashR = await nFetch(`${NOTION_API}/pages`, { method:'POST', headers:h(token), body: JSON.stringify({
        parent:{type:'page_id',page_id:pageId},
        icon:{type:'emoji',emoji:'🏠'},
        properties:{title:[{type:'text',text:{content:isFR?'Tableau de bord':'Dashboard'}}]},
        children:[
          {object:'block',type:'heading_2',heading_2:{rich_text:[{type:'text',text:{content:isFR?'🌅 Check-in quotidien':'🌅 Daily Check-in'}}]}},
          {object:'block',type:'embed',embed:{url:dailyUrl}},
          {object:'block',type:'divider',divider:{}},
          {object:'block',type:'heading_2',heading_2:{rich_text:[{type:'text',text:{content:isFR?'🗂 Accès rapide':'🗂 Quick access'}}]}},
          {object:'block',type:'bulleted_list_item',bulleted_list_item:{rich_text:[{type:'text',text:{content:(isFR?'📋 Tous les projets':'📋 All projects'),link:{url:`https://notion.so/${clean(projDbId)}`}}}]}},
          {object:'block',type:'bulleted_list_item',bulleted_list_item:{rich_text:[{type:'text',text:{content:(isFR?'✅ Toutes les tâches':'✅ All tasks'),link:{url:`https://notion.so/${clean(tachesDbId)}`}}}]}},
          {object:'block',type:'bulleted_list_item',bulleted_list_item:{rich_text:[{type:'text',text:{content:(isFR?'🌅 Historique check-ins':'🌅 Check-in history'),link:{url:`https://notion.so/${clean(ciDbId)}`}}}]}},
          {object:'block',type:'divider',divider:{}},
          {object:'block',type:'callout',callout:{icon:{type:'emoji',emoji:'💡'},rich_text:[{type:'text',text:{content:viewsNote.replace('💡 ','')}}]}}
        ]
      }) });
      const dashId = dashR.ok ? dashR.data.id : null;

      // 8 — Sous-pages Ressources par projet
      for (const proj of (projects||[]).filter(proj=>proj.name?.trim()&&(proj.links||[]).some(l=>l&&l.url&&l.url.trim()))) {
        const resourceBlocks = (proj.links||[]).filter(l=>l&&l.url&&l.url.trim()).map(l=>({
          object:'block',type:'bookmark',
          bookmark:{url:l.url.trim(),caption:l.label&&l.label.trim()?[{type:'text',text:{content:l.label.trim()}}]:[]}
        }));
        await nFetch(`${NOTION_API}/pages`, { method:'POST', headers:h(token), body: JSON.stringify({
          parent:{type:'page_id',page_id:pageId},
          icon:{type:'emoji',emoji:'📁'},
          properties:{title:[{type:'text',text:{content:`${proj.name.trim()} — ${isFR?'Ressources':'Resources'}`}}]},
          children:[
            {object:'block',type:'heading_3',heading_3:{rich_text:[{type:'text',text:{content:isFR?'Liens et documents':'Links & documents'}}]}},
            ...resourceBlocks
          ]
        }) });
      }

      return res.status(200).json({
        success: true,
        workspace_url: `https://notion.so/${clean(pageId)}`,
        dashboard_url: dashId ? `https://notion.so/${clean(dashId)}` : `https://notion.so/${clean(pageId)}`,
        projets_url: `https://notion.so/${clean(projDbId)}`,
        taches_url: `https://notion.so/${clean(tachesDbId)}`,
        checkins_url: `https://notion.so/${clean(ciDbId)}`,
        projets_db_id: projDbId,
        taches_db_id: tachesDbId,
        checkins_db_id: ciDbId,
        daily_url: dailyUrl
      });
    }

    // ── CHECK-IN (daily.html) ─────────────────────────────────────────────────

    // Tâches à venir (non terminées) pour sélection matin
    // Historique check-ins pour adaptation quotidienne
    if (action === 'get_checkins_history') {
      const r = await fetch(`${NOTION_API}/databases/${p.database_id}/query`, { method:'POST', headers:h(token), body: JSON.stringify({ sorts:[{property:'Date',direction:'descending'}], page_size:p.limit||28 }) });
      return res.status(r.status).json(await r.json());
    }

    if (action === 'get_tasks_upcoming') {
      const doneStatus = p.lang === 'en' ? 'Done' : 'Fait';
      const r = await fetch(`${NOTION_API}/databases/${p.database_id}/query`, { method:'POST', headers:h(token), body: JSON.stringify({
        filter:{and:[{property:'Statut',select:{does_not_equal:doneStatus}},{property:'Statut',select:{does_not_equal:'Reporté'}},{property:'Statut',select:{does_not_equal:'Postponed'}}]},
        sorts:[{property:'Date',direction:'ascending'}], page_size:20
      }) });
      return res.status(r.status).json(await r.json());
    }

    // Créer check-in du matin
    if (action === 'create_checkin_morning') {
      const { database_id, date, energie, tasks_planned, lang: cl='fr' } = p;
      const isFR = cl === 'fr';
      const r = await fetch(`${NOTION_API}/pages`, { method:'POST', headers:h(token), body: JSON.stringify({
        parent:{database_id},
        properties:{
          [isFR?'Titre':'Title']:{title:[{text:{content:`${isFR?'Matin':'Morning'} — ${date}`}}]},
          'Date':{date:{start:date}},
          'Moment':{select:{name:isFR?'Matin':'Morning'}},
          [isFR?'Énergie':'Energy']:{select:{name:energie}},
          [isFR?'Tâches prévues':'Planned tasks']:{rich_text:[{text:{content:tasks_planned||''}}]}
        }
      }) });
      return res.status(r.status).json(await r.json());
    }

    // Mettre à jour check-in du soir
    if (action === 'update_checkin_evening') {
      const { page_id, date, taches_faites, ressenti, notes, lang: cl='fr' } = p;
      const isFR = cl === 'fr';
      const r = await fetch(`${NOTION_API}/pages/${page_id}`, { method:'PATCH', headers:h(token), body: JSON.stringify({
        properties:{
          [isFR?'Titre':'Title']:{title:[{text:{content:`${isFR?'Journée':'Day'} — ${date}`}}]},
          'Moment':{select:{name:isFR?'Complet':'Complete'}},
          [isFR?'Tâches faites':'Tasks done']:{number:taches_faites||0},
          [isFR?'Ressenti':'Feeling']:{select:{name:ressenti}},
          ...(notes?{[isFR?'Notes':'Notes']:{rich_text:[{text:{content:notes}}]}}:{})
        }
      }) });
      return res.status(r.status).json(await r.json());
    }

    // Générique : créer une page / patcher une page
    if (action === 'create_page') {
      const r = await fetch(`${NOTION_API}/pages`, { method:'POST', headers:h(token), body: JSON.stringify({parent:{database_id:p.database_id},properties:p.properties}) });
      return res.status(r.status).json(await r.json());
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch(err) {
    console.error('Notion proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
