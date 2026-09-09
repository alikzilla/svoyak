import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AuctionView, PlayerPublic } from '@svoyak/shared';
import { Avatar, colorForIndex } from '../../design/Avatar.js';
import { Doodle } from '../../design/Doodles.js';

interface AuctionSceneProps {
  auction: AuctionView;
  players: PlayerPublic[];
  nominal: number;
}

interface Bubble {
  id: number;
  amount: number;
  color: string;
  name: string;
  allIn: boolean;
}

/** Сцена аукциона: молоток, пузыри ставок и золотая вспышка на ва-банке. */
export function AuctionScene({ auction, players, nominal }: AuctionSceneProps) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const lastBid = useRef(auction.currentBid);
  const counter = useRef(0);

  const indexOf = (id: string | null): number =>
    players.findIndex((player) => player.id === id);

  const leader = players.find((player) => player.id === auction.leaderId);
  const turn = players.find((player) => player.id === auction.turnPlayerId);
  const allIn = leader !== undefined && auction.currentBid >= leader.score && auction.currentBid > nominal;

  // Каждая новая ставка выпускает пузырь — видно, как растут торги.
  useEffect(() => {
    if (auction.currentBid === lastBid.current) return;
    lastBid.current = auction.currentBid;
    if (!leader) return;

    counter.current += 1;
    const bubble: Bubble = {
      id: counter.current,
      amount: auction.currentBid,
      color: colorForIndex(indexOf(leader.id)),
      name: leader.name,
      allIn,
    };
    setBubbles((current) => [...current, bubble]);
    const timer = window.setTimeout(
      () => setBubbles((current) => current.filter((item) => item.id !== bubble.id)),
      1600,
    );
    return () => clearTimeout(timer);
  }, [auction.currentBid, leader, allIn]);

  return (
    <motion.div
      className="relative grid justify-items-center gap-4 text-center"
      // Ва-банк встряхивает сцену.
      animate={allIn ? { x: [0, -10, 10, -6, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      {allIn && (
        <motion.div
          className="pointer-events-none absolute inset-0 -m-10 rounded-[3rem]"
          style={{ backgroundColor: 'var(--color-gold)' }}
          initial={{ opacity: 0.75 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9 }}
        />
      )}

      <div className="relative flex items-center gap-4">
        <motion.div
          animate={{ rotate: [-18, 12, -18] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Doodle name="hammer" size={84} color="#1a1a1a" fill="#f2a93b" strokeWidth={5} />
        </motion.div>
        <div className="grid justify-items-start">
          <p className="font-body text-lg font-bold opacity-75">аукцион</p>
          <p
            className="font-pop text-[clamp(3rem,8vw,5rem)] leading-none font-black tabular-nums"
            style={{ WebkitTextStroke: '4px #1a1a1a', paintOrder: 'stroke fill', color: '#ffc53d' }}
          >
            {auction.currentBid}
          </p>
        </div>
      </div>

      <div className="relative h-24 w-full">
        <AnimatePresence>
          {bubbles.map((bubble, index) => (
            <motion.div
              key={bubble.id}
              className="ink-border font-pop absolute left-1/2 rounded-full px-4 py-2 text-xl font-black"
              style={{ backgroundColor: bubble.color, boxShadow: '4px 4px 0 #1a1a1a' }}
              initial={{ y: 60, x: '-50%', scale: 0.4, opacity: 0 }}
              animate={{ y: -20 - index * 6, x: `${-50 + (index % 2 ? 34 : -34)}%`, scale: 1, opacity: 1 }}
              exit={{ y: -90, opacity: 0, scale: 0.7 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            >
              {bubble.name}: {bubble.allIn ? 'ва-банк ' : ''}
              {bubble.amount}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {leader && (
        <div className="flex items-center gap-3">
          <Avatar seed={leader.name} color={colorForIndex(indexOf(leader.id))} size={56} />
          <p className="font-pop text-2xl font-black">впереди {leader.name}</p>
        </div>
      )}

      <p className="font-body text-lg font-bold opacity-75">
        {turn ? `ходит ${turn.name}` : 'торги закончены'}
      </p>
    </motion.div>
  );
}
