// Gram Legends — TON wallet link (TON Connect) and NFT requests for numbered alliance cards.
// Players link a wallet in the game; for an alliance card they own (with its serial #) they can request it as an NFT.
// Minting itself is done by the admin (it needs a deployed NFT collection and TON for fees), so requests are queued:
//   /nft list · /nft done <n> (minted) · /nft reject <n>
const ADDR = /^(-?\d+:[0-9a-fA-F]{64}|[A-Za-z0-9_-]{48})$/;

module.exports = function createWallet({ db, persist, tg, admins, E }) {
  db.nft = db.nft || [];
  const fail = (code, status = 400) => { throw Object.assign(new Error(code), { code: status }); };
  const mine = u => db.nft.filter(r => r.uid === u.id).map(({ n, id, serial, status, at }) => ({ n, id, serial, status, at }));
  const routes = {
    'POST /api/wallet': (body, u) => {
      if (body.address === null) { u.wallet = null; persist(); return { wallet: null, nft: mine(u) }; }
      if (body.address !== undefined) { if (!ADDR.test(String(body.address))) fail('bad_address'); u.wallet = String(body.address); u.walletAt = Date.now(); persist(); }
      return { wallet: u.wallet || null, nft: mine(u) };
    },
    'POST /api/nft/request': (body, u) => {
      const p = u.profile, f = E.HERO_BY_ID[body.id];
      if (!p || !f || !f.fusion) fail('bad_item');
      if (!p.owned[f.id] || !p.serials[f.id]) fail('not_owned');
      if (!u.wallet) fail('no_wallet');
      if (db.nft.some(r => r.uid === u.id && r.id === f.id && r.status !== 'rejected')) fail('claimed');
      const n = (db.nft.reduce((a, r) => Math.max(a, r.n), 0) || 0) + 1;
      db.nft.push({ n, uid: u.id, name: u.name, id: f.id, num: f.num, title: f.name, serial: p.serials[f.id], wallet: u.wallet, status: 'requested', at: Date.now() });
      persist();
      for (const a of admins()) tg('sendMessage', { chat_id: Number(a), text: `🖼 NFT request #${n}: ${f.name} (#${f.num}) serial ${p.serials[f.id]} → ${u.wallet} (${u.name})` }).catch(() => {});
      return { nft: mine(u) };
    },
  };
  async function handle(m) {
    const say = text => tg('sendMessage', { chat_id: m.chat.id, text });
    if (!admins().has(String(m.from.id))) return say(`Your Telegram ID is ${m.from.id}. Only admins can manage NFT requests.`);
    const [cmd, arg] = m.text.replace(/^\/nft(@\w+)?/, '').trim().split(/\s+/);
    const r = db.nft.find(x => x.n === +arg);
    if ((cmd === 'done' || cmd === 'reject') && r) {
      r.status = cmd === 'done' ? 'minted' : 'rejected'; persist();
      tg('sendMessage', { chat_id: Number(r.uid), text: cmd === 'done' ? `🖼 Your ${r.title} #${r.serial} NFT was sent to your wallet!` : `Your NFT request for ${r.title} was not accepted.` }).catch(() => {});
      return say(`#${r.n} → ${r.status}`);
    }
    const open = db.nft.filter(x => x.status === 'requested');
    return say((open.map(x => `#${x.n} ${x.title} (#${x.num}) serial ${x.serial} · ${x.name} · ${x.wallet}`).join('\n') || 'No pending NFT requests.') + '\n\n/nft done <n> · /nft reject <n>');
  }
  return { routes, handle };
};
