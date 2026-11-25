'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import AssignmentCard from './AssignmentCard';
import Hud, { BadgeRow } from './Hud';
import Leaderboard from './Leaderboard';
import { colorOf, statusOf } from '@/lib/format';
import { badgesOf, comboOf, totalXp, xpParts, XP_ON_TIME, XP_SUBMIT } from '@/lib/arcade';
import type { Assignment, Submission } from '@/lib/types';

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<Assignment[] | null>(null);
  const [subs, setSubs] = useState<Record<string, Submission>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const sb = supabase();
      const [a, s] = await Promise.all([
        sb.from('assignments').select('*').order('deadline', { ascending: true }),
        sb.from('submissions').select('*').eq('student_id', user.id),
      ]);
      if (!alive) return;
      if (a.error || s.error) {
        setError('Data tugas tidak bisa dimuat. Muat ulang halaman.');
        setItems([]);
        return;
      }
      const map: Record<string, Submission> = {};
      (s.data as Submission[]).forEach((x) => (map[x.assignment_id] = x));
      setSubs(map);
      setItems(a.data as Assignment[]);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const rows = useMemo(() => (items ?? []).map((a) => ({ a, s: subs[a.id] ?? null, st: statusOf(a, subs[a.id]) })), [items, subs]);
  const xp = useMemo(() => totalXp(rows), [rows]);
  const combo = useMemo(() => comboOf(rows), [rows]);
  const badges = useMemo(() => badgesOf(rows, combo), [rows, combo]);

  if (items === null) return <p className="muted">Memuat tugas…</p>;

  const first = (profile?.full_name ?? '').split(' ')[0] || 'Player';
  const pending = rows.filter((r) => r.st.k === 'open' || r.st.k === 'openlate');
  const rest = rows.filter((r) => !(r.st.k === 'open' || r.st.k === 'openlate')).reverse();

  return (
    <>
      {error && <div className="notice err">{error}</div>}
      <h1 className="page-title">
        Player 1: <mark>{first}</mark>
      </h1>
      <p className="lead">
        {pending.length
          ? `${pending.length} kaset tugas menunggu kamu. Setor untuk dapat XP.`
          : rows.length
            ? 'Semua tugas yang terbuka sudah disetor. Tunggu nilai dari dosen.'
            : 'Belum ada tugas dari dosen. Kembali lagi nanti.'}
      </p>

      <Hud name={profile?.full_name ?? first} xp={xp} combo={combo} color={items[0] ? colorOf(items[0].id) : 'pink'} />
      <BadgeRow badges={badges} />

      {rows.length === 0 && (
        <div className="empty" style={{ marginTop: 40 }}>
          <div className="empty-art" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <h3>Rak kosong</h3>
          <p>Begitu dosen membuat tugas, kasetnya muncul di sini lengkap dengan tenggat dan hadiah XP.</p>
        </div>
      )}

      {pending.length > 0 && (
        <>
          <div className="sec-head">
            <h2>Pilih kaset</h2>
            <span className="count">{pending.length} TUGAS</span>
          </div>
          <div className="grid">
            {pending.map((r) => (
              <AssignmentCard key={r.a.id} a={r.a} status={r.st} />
            ))}
          </div>
        </>
      )}

      {rest.length > 0 && (
        <>
          <div className="sec-head">
            <h2>Riwayat main</h2>
            <span className="count">{rest.length} TUGAS</span>
          </div>
          <div className="grid">
            {rest.map((r) => (
              <AssignmentCard key={r.a.id} a={r.a} status={r.st} score={r.s?.score ?? null} xp={r.s ? xpParts(r.a, r.s).total : null} />
            ))}
          </div>
        </>
      )}

      <div className="sec-head">
        <h2>Papan skor dan aturan main</h2>
      </div>
      <div className="two">
        <Leaderboard />
        <section className="card" aria-label="Cara dapat XP">
          <div className="win-title" style={{ ['--c' as string]: 'var(--green)' }}>
            Cara dapat XP
          </div>
          <ul className="rules">
            <li>
              <span>Setor tugas</span>
              <b>+{XP_SUBMIT} XP</b>
            </li>
            <li>
              <span>Setor tepat waktu</span>
              <b>+{XP_ON_TIME} XP</b>
            </li>
            <li>
              <span>Nilai dari dosen (nilai dibagi nilai maksimal)</span>
              <b>+0 s/d 100 XP</b>
            </li>
            <li>
              <span>Setiap {200} XP naik 1 level</span>
              <b>LV UP</b>
            </li>
          </ul>
          <p className="board-foot" style={{ display: 'block' }}>
            XP hanya untuk seru-seruan. Nilai kuliahmu tetap ditentukan dosen.
          </p>
        </section>
      </div>
    </>
  );
}
