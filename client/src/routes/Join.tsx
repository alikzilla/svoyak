import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { JoinRoomResult } from '@svoyak/shared';
import { ask } from '../net/socket.js';
import { saveSession } from '../net/session.js';
import { Avatar, colorForIndex } from '../design/Avatar.js';
import { DoodleButton } from '../design/DoodleButton.js';
import { DoodleField } from '../design/Doodles.js';
import { RoughFrame } from '../design/rough.js';

export default function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const codeFromLink = (params.get('code') ?? '').replace(/\D/g, '').slice(0, 6);

  const [code, setCode] = useState(codeFromLink);
  const [name, setName] = useState('');
  const [editingCode, setEditingCode] = useState(codeFromLink.length < 4);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameField = useRef<HTMLInputElement>(null);

  // Код пришёл из QR — гостю остаётся только имя, открываем клавиатуру сразу.
  useEffect(() => {
    if (!editingCode) nameField.current?.focus();
  }, [editingCode]);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await ask<JoinRoomResult>('room:join', { code: code.trim(), name: name.trim() });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    saveSession({
      role: 'player',
      code: code.trim(),
      token: result.data.sessionToken,
      playerId: result.data.playerId,
      name: name.trim(),
    });
    void navigate('/play');
  };

  const ready = code.trim().length >= 4 && name.trim().length > 0;
  // Персонаж собирается из имени — показываем его сразу, ещё до входа.
  const preview = name.trim() === '' ? 'кто-то' : name.trim();

  return (
    <div className="screen-lock relative flex flex-col overflow-y-auto overscroll-contain p-5 select-none">
      <DoodleField density="light" night />

      <form
        className="relative my-auto grid w-full max-w-sm gap-4 self-center"
        onSubmit={(event) => void submit(event)}
      >
        <div className="grid justify-items-center gap-2">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={preview}
              initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 14 }}
            >
              <Avatar seed={preview} color={colorForIndex(preview.length)} size={116} />
            </motion.div>
          </AnimatePresence>
          <h1
            className="font-pop text-4xl font-black"
            style={{ WebkitTextStroke: '3px #1a1a1a', paintOrder: 'stroke fill', color: '#fff6e9' }}
          >
            Свояк
          </h1>
        </div>

        {editingCode ? (
          <label className="font-body grid gap-1.5 text-sm font-bold">
            код комнаты
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              enterKeyHint="next"
              autoComplete="off"
              autoFocus={code.length === 0}
              placeholder="1234"
              className="ink-border font-pop bg-card text-ink rounded-2xl px-4 py-4 text-center text-4xl font-black tabular-nums"
              style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
            />
          </label>
        ) : (
          <RoughFrame
            fill="var(--color-card)"
            seed={4}
            contentClassName="text-ink flex items-center justify-between gap-3 px-4 py-2"
          >
            <span className="font-body text-sm font-bold opacity-70">комната</span>
            <span className="font-pop text-2xl font-black tabular-nums">{code}</span>
            <button
              type="button"
              onClick={() => setEditingCode(true)}
              className="font-body text-sm font-bold underline underline-offset-4 opacity-70"
            >
              другая
            </button>
          </RoughFrame>
        )}

        <label className="font-body grid gap-1.5 text-sm font-bold">
          как вас звать
          <input
            ref={nameField}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={20}
            autoComplete="nickname"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Вася"
            className="ink-border font-pop bg-card text-ink rounded-2xl px-4 py-4 text-center text-2xl font-black"
            style={{ boxShadow: '5px 5px 0 #1a1a1a' }}
          />
        </label>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ x: -8, opacity: 0 }}
              animate={{ x: [8, -6, 4, 0], opacity: 1 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="ink-border bg-no font-body rounded-2xl px-3 py-2 text-center font-bold text-white"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <DoodleButton
          tone="p5"
          size="lg"
          tilt={-1}
          idle={ready && !busy}
          disabled={!ready || busy}
          className="w-full"
          onClick={() => nameField.current?.form?.requestSubmit()}
        >
          {busy ? 'заходим…' : 'Играть'}
        </DoodleButton>
      </form>
    </div>
  );
}
