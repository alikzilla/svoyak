import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

/** QR рисуется на клиенте: код комнаты меняется, а интернета у гостей может не быть. */
export function QrCode({ value, size = 220, className }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: '#070713', light: '#f3c74a' },
    }).then((url) => {
      if (alive) setDataUrl(url);
    });
    return () => {
      alive = false;
    };
  }, [value, size]);

  if (!dataUrl) return <div style={{ width: size, height: size }} className={className} />;
  return (
    <img
      src={dataUrl}
      alt={`QR-код для подключения: ${value}`}
      width={size}
      height={size}
      className={className}
    />
  );
}
