// Gram Legends — database backups. Every day (and on /backup) the whole JSON database is gzipped,
// kept on disk for BACKUP_KEEP days next to the data file, and sent to every admin as a Telegram document.
// Restore: download the .json.gz from Telegram, gunzip it, and put it in place of DATA_FILE while the server is stopped.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const DAY = 864e5;

module.exports = function createBackup({ db, dataFile, admins, sendDocument, logErr = () => {}, hourUtc = 3, keep = 7 }) {
  const dir = path.join(path.dirname(dataFile), 'backups');
  const stamp = (t = Date.now()) => new Date(t).toISOString().slice(0, 16).replace(/[:T]/g, '-');

  function snapshot() {
    const buf = zlib.gzipSync(Buffer.from(JSON.stringify(db)));
    fs.mkdirSync(dir, { recursive: true });
    const name = `gram-legends-${stamp()}.json.gz`;
    fs.writeFileSync(path.join(dir, name), buf);
    // keep the newest `keep` files
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort();
    for (const f of files.slice(0, Math.max(0, files.length - keep))) fs.unlinkSync(path.join(dir, f));
    return { name, buf };
  }

  async function run(to = [...admins()]) {
    const { name, buf } = snapshot();
    const users = Object.keys(db.users || {}).length;
    const caption = `🗄 Gram Legends backup · ${users} users · ${(buf.length / 1024).toFixed(0)} KB`;
    for (const chat of to) await sendDocument(chat, name, buf, caption).catch(e => logErr('lastSendError', e));
    db.lastBackup = Date.now();
    return { name, size: buf.length, users };
  }

  // Check every 10 minutes; run once a day after hourUtc.
  const timer = setInterval(() => {
    const now = new Date();
    if (now.getUTCHours() >= hourUtc && Date.now() - (db.lastBackup || 0) > DAY - 30 * 60e3) run().catch(e => logErr('backupError', e));
  }, 10 * 60e3);
  if (timer.unref) timer.unref();

  return { run, snapshot, dir, stop: () => clearInterval(timer) };
};
