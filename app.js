(() => {
  // ---- データ層（localStorage） -------------------------
  const DB_KEYS = {
    users: 'uni_users',
    items: 'uni_items',
    sessions: 'uni_session',
    favorites: 'uni_favorites',
    watchlist: 'uni_watchlist',
    history: 'uni_history',
    messages: 'uni_messages',
    orders: 'uni_orders',
    notifications: 'uni_notifications',
  };
  const now = () => new Date().toISOString();
  const uid = () => 'u_' + Math.random().toString(36).slice(2,10);
  const iid = () => 'i_' + Math.random().toString(36).slice(2,10);
  const tid = () => 't_' + Math.random().toString(36).slice(2,10);
  const oid = () => 'o_' + Math.random().toString(36).slice(2,10);

  const read = (k, d) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d));
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const db = {
    get users(){ return read(DB_KEYS.users, []); },
    set users(v){ write(DB_KEYS.users, v); },
    get items(){ return read(DB_KEYS.items, []); },
    set items(v){ write(DB_KEYS.items, v); },
    get session(){ return read(DB_KEYS.sessions, { currentUserId: null }); },
    set session(v){ write(DB_KEYS.sessions, v); },
    get favorites(){ return read(DB_KEYS.favorites, {}); }, // {userId: [itemIds]}
    set favorites(v){ write(DB_KEYS.favorites, v); },
    get watchlist(){ return read(DB_KEYS.watchlist, {}); },
    set watchlist(v){ write(DB_KEYS.watchlist, v); },
    get history(){ return read(DB_KEYS.history, {}); },
    set history(v){ write(DB_KEYS.history, v); },
    get messages(){ return read(DB_KEYS.messages, {}); }, // {threadId: {id, itemId, users:[u1,u2], msgs:[{from, text, ts}]}}
    set messages(v){ write(DB_KEYS.messages, v); },
    get orders(){ return read(DB_KEYS.orders, []); },
    set orders(v){ write(DB_KEYS.orders, v); },
    get notifications(){ return read(DB_KEYS.notifications, {}); }, // {userId:[{id, text, ts}]}
    set notifications(v){ write(DB_KEYS.notifications, v); },
  };

  // ダミーデータ投入（初回）
  function seedIfEmpty(){
    if (db.items.length) return;
    const seller = ensureDemoUser();
    const samples = [
      {title:'ミクロ経済学 第4版', category:'textbook', condition:'good', price:1800, university:'横浜国立大学', desc:'授業で必須。書き込み少しあり', images:[],
        textbook:{isbn:'978-xxxxxxx', edition:'第4版', year:2022, professor:'山田太郎', course:'ミクロ経済学', required:'required'},
      },
      {title:'ノートPC (13インチ)', category:'daily', condition:'fair', price:25000, university:'慶應義塾大学', desc:'サブ機。傷あり', images:[],
        textbook:null,
      },
      {title:'統計学入門', category:'textbook', condition:'new', price:2200, university:'東京大学', desc:'新品同様', images:[],
        textbook:{isbn:'978-yyyyyyy', edition:'第2版', year:2023, professor:'佐藤花子', course:'統計学', required:'recommended'},
      },
    ];
    const enriched = samples.map(s=>({
      id: iid(), ownerId: seller.id, status:'available', delivery:'meet', payment:'cash', views:0,
      expire:null, createdAt: now(), updatedAt: now(), ...s
    }));
    db.items = enriched;
  }

  function ensureDemoUser(){
    const u = db.users;
    let me = u.find(x=>x.email==='demo@univ.ac.jp');
    if (!me){
      me = { id: uid(), email:'demo@univ.ac.jp', password:'password', profile:{
        university:'横浜国立大学', faculty:'経済学部', department:'経済学科', grade:'3年', bio:'デモユーザー', agreed:false
      }, createdAt: now() };
      u.push(me); db.users = u;
    }
    return me;
  }

  seedIfEmpty();

  // ---- UIヘルパ -------------------------
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const fmtYen = n => new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY'}).format(+n||0);
  const el = (tag, cls, txt) => { const e=document.createElement(tag); if(cls) e.className=cls; if(txt) e.textContent=txt; return e; };

  // ---- 認証 ------------------------------
  const dlgAuth = $('#dlg-auth');
  $('#btn-open-login').addEventListener('click', () => dlgAuth.showModal());
  $('#btn-auth-login').addEventListener('click', (ev)=>{
    ev.preventDefault();
    const email = $('#auth-email').value.trim();
    const pass = $('#auth-pass').value;
    const user = db.users.find(u=>u.email===email && u.password===pass);
    if (!user){ alert('メールまたはパスワードが違います'); return; }
    db.session = { currentUserId: user.id };
    dlgAuth.close();
    toast(`ようこそ、${email}`);
    renderAll();
  });
  $('#btn-auth-register').addEventListener('click', (ev)=>{
    ev.preventDefault();
    const email = $('#auth-email').value.trim();
    const pass = $('#auth-pass').value;
    if (!/.+@.+\..+/.test(email)) return alert('メール形式が不正です');
    if (pass.length < 8) return alert('パスワードは8文字以上');
    if (db.users.some(u=>u.email===email)) return alert('既に登録済みです');
    const user = { id: uid(), email, password: pass, profile: { university:'', faculty:'', department:'', grade:'', bio:'', agreed:false }, createdAt: now() };
    db.users = [...db.users, user];
    db.session = { currentUserId: user.id };
    dlgAuth.close(); toast('登録しました');
    renderAll();
  });

  // ---- プロフィール ----------------------
  const dlgProfile = $('#dlg-profile');
  $('#btn-open-profile').addEventListener('click', ()=>{
    const me = currentUser();
    if (!me){ dlgAuth.showModal(); return; }
    $('#pf-university').value = me.profile.university||'';
    $('#pf-faculty').value = me.profile.faculty||'';
    $('#pf-department').value = me.profile.department||'';
    $('#pf-grade').value = me.profile.grade||'';
    $('#pf-bio').value = me.profile.bio||'';
    $('#pf-terms').checked = !!me.profile.agreed;
    dlgProfile.showModal();
  });
  $('#btn-save-profile').addEventListener('click', (ev)=>{
    ev.preventDefault();
    const me = currentUser(); if(!me) return;
    me.profile.university = $('#pf-university').value.trim();
    me.profile.faculty = $('#pf-faculty').value.trim();
    me.profile.department = $('#pf-department').value.trim();
    me.profile.grade = $('#pf-grade').value;
    me.profile.bio = $('#pf-bio').value.trim();
    me.profile.agreed = $('#pf-terms').checked;
    db.users = db.users.map(u=>u.id===me.id?me:u);
    dlgProfile.close(); toast('プロフィールを保存しました');
    renderAll();
  });
  $('#btn-delete-account').addEventListener('click', (ev)=>{
    ev.preventDefault();
    const me = currentUser(); if(!me) return;
    if (!confirm('本当にアカウントを削除しますか？この操作は元に戻せません。')) return;
    db.users = db.users.filter(u=>u.id!==me.id);
    db.session = { currentUserId: null };
    toast('アカウントを削除しました');
    dlgProfile.close(); renderAll();
  });

  function currentUser(){
    const id = db.session.currentUserId; if(!id) return null;
    return db.users.find(u=>u.id===id)||null;
  }

  // ---- 検索・フィルタ ---------------------
  $('#btn-search').addEventListener('click', renderMarket);
  $('#btn-clear').addEventListener('click', ()=>{
    $('#q-keyword').value=''; $('#q-category').value=''; $('#q-condition').value='';
    $('#q-min').value=''; $('#q-max').value=''; $('#q-univ').value=''; $('#q-sort').value='newest';
    renderMarket();
  });

  function filterItems(list){
    const kw = $('#q-keyword').value.trim().toLowerCase();
    const cat = $('#q-category').value;
    const cond = $('#q-condition').value;
    const min = +($('#q-min').value||0);
    const max = +($('#q-max').value||Infinity);
    const univ = $('#q-univ').value.trim().toLowerCase();
    const sort = $('#q-sort').value;

    let res = list.filter(it=>{
      if (cat && it.category!==cat) return false;
      if (cond && it.condition!==cond) return false;
      if (!(it.price>=min && it.price<=max)) return false;
      if (univ && !(it.university||'').toLowerCase().includes(univ)) return false;
      if (kw){
        const hay = [it.title, it.desc, it.university, it.textbook?.professor, it.textbook?.course, it.textbook?.isbn].join(' ').toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    if (sort==='price-asc') res.sort((a,b)=>a.price-b.price);
    else if (sort==='price-desc') res.sort((a,b)=>b.price-a.price);
    else if (sort==='popular') res.sort((a,b)=> (b.views||0) - (a.views||0));
    else res.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));

    return res;
  }

  // ---- タブ切替 ---------------------------
  $$('.tab').forEach(t=>t.addEventListener('click', ()=>selectTab(t.dataset.tab)));
  $$('.quick-links .chip').forEach(c=>c.addEventListener('click', ()=>selectTab(c.dataset.tab)));
  function selectTab(name){
    $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===name));
    $$('.panel').forEach(p=>p.classList.toggle('active', p.id===`panel-${name}`));
    if (name==='messages') renderThreads();
    if (name==='orders') renderOrders();
  }

  // ---- 出品 --------------------------------
  const dlgNew = $('#dlg-new');
  $('#btn-open-new').addEventListener('click', ()=>{
    const me = currentUser();
    if (!me){ dlgAuth.showModal(); return; }
    clearNewForm(); dlgNew.showModal();
  });

  $('#item-category').addEventListener('change', ()=>{
    $('#textbook-fields').style.display = ($('#item-category').value==='textbook') ? 'block' : 'none';
  });

  const imageFiles = [];
  $('#item-images').addEventListener('change', (e)=>{
    imageFiles.length = 0;
    const files = Array.from(e.target.files).slice(0,4);
    const wrap = $('#image-preview'); wrap.innerHTML='';
    files.forEach(f=>{
      const reader = new FileReader();
      reader.onload = () => {
        imageFiles.push(reader.result);
        const img = el('img'); img.src = reader.result; wrap.appendChild(img);
      };
      reader.readAsDataURL(f);
    });
  });

  function clearNewForm(){
    $('#new-form').dataset.editId = '';
    $('#item-category').value='textbook';
    $('#item-condition').value='good';
    $('#item-title').value='';
    $('#item-desc').value='';
    $('#item-price').value='';
    $('#item-expire').value='';
    $('#item-university').value=currentUser()?.profile.university||'';
    $('#tb-isbn').value=''; $('#tb-edition').value=''; $('#tb-year').value='';
    $('#tb-prof').value=''; $('#tb-course').value=''; $('#tb-required').value='';
    $('#item-delivery').value='meet'; $('#item-payment').value='cash'; $('#item-status').value='available';
    $('#image-preview').innerHTML=''; imageFiles.length=0;
    $('#textbook-fields').style.display='block';
  }

  $('#btn-save-item').addEventListener('click', (ev)=>{
    ev.preventDefault();
    const me = currentUser(); if(!me) return alert('ログインしてください');
    const item = {
      category: $('#item-category').value,
      condition: $('#item-condition').value,
      title: $('#item-title').value.trim(),
      desc: $('#item-desc').value.trim(),
      price: +$('#item-price').value,
      expire: $('#item-expire').value||null,
      university: $('#item-university').value.trim(),
      delivery: $('#item-delivery').value,
      payment: $('#item-payment').value,
      status: $('#item-status').value,
      textbook: $('#item-category').value==='textbook' ? {
        isbn: $('#tb-isbn').value.trim(),
        edition: $('#tb-edition').value.trim(),
        year: $('#tb-year').value? +$('#tb-year').value : null,
        professor: $('#tb-prof').value.trim(),
        course: $('#tb-course').value.trim(),
        required: $('#tb-required').value,
      } : null,
      images: imageFiles.slice(),
    };
    if (!item.title || isNaN(item.price)) return alert('タイトルと価格は必須です');

    const editId = $('#new-form').dataset.editId;
    if (editId){
      // 価格変更通知（ウォッチ中のユーザーへ）
      const before = db.items.find(x=>x.id===editId);
      const changedPrice = before && before.price !== item.price;

      db.items = db.items.map(x=> x.id===editId ? { ...x, ...item, updatedAt: now() } : x);
      if (changedPrice) notifyPriceChange(editId, item);
      toast('商品を更新しました');
    } else {
      const newItem = { id: iid(), ownerId: me.id, createdAt: now(), updatedAt: now(), views:0, ...item };
      db.items = [newItem, ...db.items];
      toast('出品しました');
    }
    dlgNew.close(); renderAll();
  });

  function notifyPriceChange(itemId, item){
    // ウォッチしている全ユーザーを探索
    const watchers = Object.entries(db.watchlist).filter(([uid, list])=> list.includes(itemId)).map(([uid])=>uid);
    const msg = `ウォッチ中の商品「${item.title}」の価格が ${fmtYen(item.price)} に変更されました`;
    pushNotifications(watchers, msg);
  }

  // ---- マーケット描画 ---------------------
  function renderMarket(){
    const grid = $('#market-grid'); grid.innerHTML='';
    const list = filterItems(db.items.filter(i=>i.status!=='sold'));
    list.forEach(it=> grid.appendChild(renderItemCard(it)) );
  }

  function renderItemCard(it){
    const t = $('#tpl-card').content.cloneNode(true);
    const card = t.querySelector('.item-card');
    const thumb = card.querySelector('.thumb');
    thumb.style.backgroundImage = `url(${(it.images?.[0])||placeholder(it.title)})`;
    card.querySelector('.title').textContent = it.title;
    card.querySelector('.price').textContent = fmtYen(it.price);
    card.querySelector('.meta').textContent = `${labelCategory(it.category)}・${labelCondition(it.condition)}・${it.university||'大学未指定'}`;

    card.querySelector('.act-view').addEventListener('click', ()=> openDetail(it.id));
    card.querySelector('.act-fav').addEventListener('click', ()=> toggleFavorite(it.id));
    card.querySelector('.act-watch').addEventListener('click', ()=> toggleWatch(it.id));
    return card;
  }

  function labelCategory(c){ return c==='textbook'?'教科書':'日用品'; }
  function labelCondition(c){ return c==='new'?'新品に近い': c==='good'?'良い':'可'; }

  function placeholder(text){
    const bg = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360">
        <rect width="100%" height="100%" fill="#0f151b"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#567" font-size="20" font-family="system-ui">${(text||'No Image').slice(0,20)}</text>
      </svg>`);
    return bg;
  }

  // ---- 詳細/閲覧履歴 ----------------------
  const dlgDetail = $('#dlg-detail');
  $('#btn-close-detail').addEventListener('click', ()=> dlgDetail.close());

  function openDetail(id){
    const it = db.items.find(x=>x.id===id); if(!it) return;
    it.views = (it.views||0)+1; db.items = db.items.map(x=>x.id===id?it:x);
    addHistory(it.id);

    $('#detail-title').textContent = it.title;
    const gal = $('#detail-gallery'); gal.innerHTML='';
    (it.images?.length? it.images : [placeholder(it.title)]).slice(0,4).forEach(src=>{
      const img = document.createElement('img'); img.src=src; gal.appendChild(img);
    });

    const meta = el('div');
    meta.innerHTML = `
      <div><strong>価格:</strong> ${fmtYen(it.price)}</div>
      <div><strong>カテゴリ:</strong> ${labelCategory(it.category)} / <strong>状態:</strong> ${labelCondition(it.condition)}</div>
      <div><strong>大学:</strong> ${it.university||'未指定'}</div>
      <div><strong>受け渡し:</strong> ${it.delivery} / <strong>決済:</strong> ${it.payment}</div>
      <div class="muted">出品: ${new Date(it.createdAt).toLocaleString()} / 閲覧: ${it.views}</div>
      <p>${(it.desc||'')}</p>`;
    $('#detail-meta').innerHTML=''; $('#detail-meta').appendChild(meta);

    const specs = $('#detail-specs'); specs.innerHTML='';
    if (it.category==='textbook' && it.textbook){
      specs.appendChild(specRow('ISBN', it.textbook.isbn||'-'));
      specs.appendChild(specRow('版数', it.textbook.edition||'-'));
      specs.appendChild(specRow('発行年', it.textbook.year||'-'));
      specs.appendChild(specRow('教授名', it.textbook.professor||'-'));
      specs.appendChild(specRow('科目', it.textbook.course||'-'));
      specs.appendChild(specRow('必須/推奨', it.textbook.required==='required'?'必須': it.textbook.required==='recommended'?'推奨':'-'));
    }

    // アクションの紐付け
    $('#btn-detail-fav').onclick = ()=> toggleFavorite(it.id);
    $('#btn-detail-watch').onclick = ()=> toggleWatch(it.id);
    $('#btn-start-chat').onclick = ()=> startChat(it.id);
    $('#btn-buy').onclick = ()=> createOrder(it.id);
    $('#btn-delete-item').onclick = ()=> { if(confirm('削除しますか？')){ db.items = db.items.filter(x=>x.id!==it.id); dlgDetail.close(); renderAll(); } };
    $('#btn-edit-item').onclick = ()=> { fillEdit(it); dlgDetail.close(); dlgNew.showModal(); };

    dlgDetail.showModal();
  }

  function specRow(k,v){ const d=el('div','row'); d.innerHTML = `<strong>${k}:</strong> ${v}`; return d; }

  function addHistory(itemId){
    const me = currentUser(); if(!me) return;
    const h = db.history; h[me.id] = [itemId, ...(h[me.id]||[]).filter(id=>id!==itemId)].slice(0,100);
    db.history = h; renderHistory();
  }

  $('#btn-clear-history').addEventListener('click', ()=>{ const me=currentUser(); if(!me) return; const h=db.history; h[me.id]=[]; db.history=h; renderHistory(); });

  // ---- お気に入り/ウォッチ -----------------
  function ensureArr(map, key){ if(!map[key]) map[key]=[]; return map[key]; }

  function toggleFavorite(itemId){
    const me = currentUser(); if(!me) return dlgAuth.showModal();
    const fav = db.favorites; const arr = ensureArr(fav, me.id);
    if (arr.includes(itemId)) fav[me.id] = arr.filter(x=>x!==itemId);
    else fav[me.id] = [itemId, ...arr];
    db.favorites = fav; renderFavorites();
  }
  function toggleWatch(itemId){
    const me = currentUser(); if(!me) return dlgAuth.showModal();
    const wl = db.watchlist; const arr = ensureArr(wl, me.id);
    if (arr.includes(itemId)) wl[me.id] = arr.filter(x=>x!==itemId);
    else wl[me.id] = [itemId, ...arr];
    db.watchlist = wl; renderWatchlist();
  }

  function renderFavorites(){
    const me=currentUser(); const grid=$('#favorites-grid'); grid.innerHTML='';
    if(!me) return;
    const ids = db.favorites[me.id]||[];
    ids.map(id=> db.items.find(i=>i.id===id)).filter(Boolean).forEach(it=> grid.appendChild(renderItemCard(it)) );
  }
  function renderWatchlist(){
    const me=currentUser(); const grid=$('#watchlist-grid'); grid.innerHTML='';
    if(!me) return;
    const ids = db.watchlist[me.id]||[];
    ids.map(id=> db.items.find(i=>i.id===id)).filter(Boolean).forEach(it=> grid.appendChild(renderItemCard(it)) );
  }
  function renderHistory(){
    const me=currentUser(); const grid=$('#history-grid'); grid.innerHTML='';
    if(!me) return;
    const ids = db.history[me.id]||[];
    ids.map(id=> db.items.find(i=>i.id===id)).filter(Boolean).forEach(it=> grid.appendChild(renderItemCard(it)) );
  }

  // ---- 自分の出品 -------------------------
  function renderMine(){
    const me=currentUser(); const grid=$('#mine-grid'); grid.innerHTML='';
    if(!me) return;
    db.items.filter(i=>i.ownerId===me.id).forEach(it=> grid.appendChild(renderItemCard(it)) );
  }

  function fillEdit(it){
    $('#new-form').dataset.editId = it.id;
    $('#item-category').value=it.category; $('#textbook-fields').style.display = (it.category==='textbook')?'block':'none';
    $('#item-condition').value=it.condition; $('#item-title').value=it.title; $('#item-desc').value=it.desc;
    $('#item-price').value=it.price; $('#item-expire').value=it.expire||''; $('#item-university').value=it.university||'';
    $('#item-delivery').value=it.delivery; $('#item-payment').value=it.payment; $('#item-status').value=it.status;
    if (it.textbook){ $('#tb-isbn').value=it.textbook.isbn||''; $('#tb-edition').value=it.textbook.edition||''; $('#tb-year').value=it.textbook.year||''; $('#tb-prof').value=it.textbook.professor||''; $('#tb-course').value=it.textbook.course||''; $('#tb-required').value=it.textbook.required||''; }
    $('#image-preview').innerHTML=''; imageFiles.length=0; (it.images||[]).slice(0,4).forEach(src=>{ imageFiles.push(src); const img=el('img'); img.src=src; $('#image-preview').appendChild(img); });
  }

  // ---- メッセージ -------------------------
  let currentThreadId = null;
  function startChat(itemId){
    const me=currentUser(); if(!me) return dlgAuth.showModal();
    const it = db.items.find(x=>x.id===itemId); if(!it) return;
    if (it.ownerId === me.id){ toast('自分自身にはメッセージできません'); return; }

    // 既存スレッド検索 or 作成
    let thread = Object.values(db.messages).find(t=> t.itemId===itemId && t.users.includes(me.id) && t.users.includes(it.ownerId));
    if (!thread){
      const id = tid();
      thread = { id, itemId, users:[me.id, it.ownerId], msgs:[], updatedAt: now() };
      db.messages = { ...db.messages, [id]: thread };
    }
    selectTab('messages');
    openThread(thread.id);
  }

  function renderThreads(){
    const me=currentUser(); const list=$('#thread-list'); list.innerHTML=''; if(!me) return;
    const threads = Object.values(db.messages).filter(t=>t.users.includes(me.id)).sort((a,b)=> new Date(b.updatedAt)-new Date(a.updatedAt));
    threads.forEach(t=>{
      const it = db.items.find(i=>i.id===t.itemId);
      const div = el('div','thread-item'+(t.id===currentThreadId?' active':''));
      div.innerHTML = `<strong>${it?.title||'削除済み'}</strong><div class="meta">${new Date(t.updatedAt).toLocaleString()}</div>`;
      div.addEventListener('click', ()=> openThread(t.id));
      list.appendChild(div);
    });
  }

  function openThread(threadId){
    currentThreadId = threadId; renderThreads();
    const t = db.messages[threadId]; if(!t) return;
    const me=currentUser();
    const otherId = t.users.find(u=>u!==me.id);
    const other = db.users.find(u=>u.id===otherId);
    $('#thread-header').textContent = `相手: ${other?.email||'不明'} / スレッドID: ${threadId}`;

    const box = $('#thread-messages'); box.innerHTML='';
    t.msgs.forEach(m=>{
      const b = el('div','bubble'+(m.from===me.id?' me':'')); b.textContent = m.text; box.appendChild(b);
    });
  }

  $('#btn-send-msg').addEventListener('click', ()=>{
    const me = currentUser(); if(!me) return;
    const t = db.messages[currentThreadId]; if(!t) return;
    const text = $('#msg-input').value.trim(); if(!text) return;
    t.msgs.push({ from: me.id, text, ts: now() }); t.updatedAt = now(); db.messages = { ...db.messages, [t.id]: t };
    $('#msg-input').value=''; openThread(t.id);
  });

  // ---- 取引（擬似） ----------------------
  function createOrder(itemId){
    const me = currentUser(); if(!me) return dlgAuth.showModal();
    const it = db.items.find(x=>x.id===itemId); if(!it) return;
    if (it.status!=='available') return alert('現在、取引できません');
    const order = { id: oid(), itemId, buyerId: me.id, sellerId: it.ownerId, status:'pending', createdAt: now() };
    db.orders = [order, ...db.orders];
    it.status='pending'; it.updatedAt=now(); db.items = db.items.map(x=>x.id===it.id?it:x);
    pushNotifications([me.id, it.ownerId], `「${it.title}」の取引が開始されました`);
    toast('購入リクエストを送信しました');
    renderAll();
  }

  function renderOrders(){
    const me=currentUser(); const wrap=$('#orders-list'); wrap.innerHTML=''; if(!me) return;
    db.orders.filter(o=> o.buyerId===me.id || o.sellerId===me.id).forEach(o=>{
      const it = db.items.find(i=>i.id===o.itemId);
      const card = el('div','order-card');
      card.innerHTML = `
        <div>
          <div><strong>${it?.title||'削除済み商品'}</strong></div>
          <div class="meta">状態: ${o.status} / 開始: ${new Date(o.createdAt).toLocaleString()}</div>
        </div>
        <div class="actions">
          <button class="btn btn-sm" data-act="complete">完了</button>
          <button class="btn btn-sm" data-act="cancel">キャンセル</button>
        </div>`;
      card.querySelector('[data-act="complete"]').addEventListener('click', ()=> completeOrder(o.id));
      card.querySelector('[data-act="cancel"]').addEventListener('click', ()=> cancelOrder(o.id));
      wrap.appendChild(card);
    });
  }

  function completeOrder(orderId){
    const o = db.orders.find(x=>x.id===orderId); if(!o) return;
    o.status='completed'; db.orders = db.orders.map(x=>x.id===o.id?o:x);
    const it = db.items.find(i=>i.id===o.itemId); if(it){ it.status='sold'; it.updatedAt=now(); db.items = db.items.map(x=>x.id===it.id?it:x); }
    pushNotifications([o.buyerId,o.sellerId], '取引が完了しました。相互評価をお願いします（デモ）');
    toast('取引を完了しました'); renderAll();
  }
  function cancelOrder(orderId){
    const o = db.orders.find(x=>x.id===orderId); if(!o) return;
    o.status='canceled'; db.orders = db.orders.map(x=>x.id===o.id?o:x);
    const it = db.items.find(i=>i.id===o.itemId); if(it && it.status==='pending'){ it.status='available'; it.updatedAt=now(); db.items = db.items.map(x=>x.id===it.id?it:x); }
    pushNotifications([o.buyerId,o.sellerId], '取引がキャンセルされました');
    toast('取引をキャンセルしました'); renderAll();
  }

  // ---- 通知 -------------------------------
  function pushNotifications(userIds, text){
    const m = db.notifications;
    userIds.forEach(id=>{ if(!m[id]) m[id]=[]; m[id].unshift({ id: 'n_'+Math.random().toString(36).slice(2,8), text, ts: now() }); });
    db.notifications = m; renderNotifications();
  }
  function renderNotifications(){
    const me=currentUser(); const ul=$('#notification-list'); ul.innerHTML=''; if(!me) return;
    (db.notifications[me.id]||[]).slice(0,10).forEach(n=>{
      const li=el('li'); li.textContent = `[${new Date(n.ts).toLocaleString()}] ${n.text}`; ul.appendChild(li);
    });
  }

  // ---- 描画集約 ---------------------------
  function renderAll(){
    renderMarket(); renderFavorites(); renderWatchlist(); renderHistory(); renderMine(); renderThreads(); renderOrders(); renderNotifications();
  }

  // ---- 便利UI -----------------------------
  function toast(msg){
    const t = el('div'); t.textContent = msg; Object.assign(t.style, { position:'fixed', bottom:'16px', left:'50%', transform:'translateX(-50%)', background:'#111a', border:'1px solid #333', backdropFilter:'blur(6px)', color:'#fff', padding:'10px 14px', borderRadius:'10px', zIndex:9999});
    document.body.appendChild(t); setTimeout(()=> t.remove(), 2200);
  }

  // 初期表示
  renderAll();
})();
