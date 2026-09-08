interface RoomCodeProps {
  code: string;
  size?: 'lg' | 'xl';
}

/** Код комнаты — главный элемент экрана ведущего: его диктуют и набирают вручную. */
export function RoomCode({ code, size = 'lg' }: RoomCodeProps) {
  const scale = size === 'xl' ? 'text-[clamp(4rem,3rem+8vw,9rem)]' : 'text-[clamp(3rem,2rem+6vw,6rem)]';
  return (
    <div
      className={`${scale} font-black leading-none tracking-[0.12em] text-gold tabular-nums`}
      aria-label={`Код комнаты ${code.split('').join(' ')}`}
    >
      {code}
    </div>
  );
}
