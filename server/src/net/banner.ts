import qrcode from 'qrcode-terminal';
import { getLanAddress } from './lan.js';

/** Печатает при старте адреса подключения и QR-код для телефонов. */
export function printBanner(
  clientPort: number,
  serverPort: number,
  publicUrl: string | null = null,
): void {
  const lan = getLanAddress();
  const joinUrl = publicUrl ?? (lan ? `http://${lan}:${clientPort}/join` : null);

  const line = '─'.repeat(52);
  console.log(`\n\x1b[35m${line}\x1b[0m`);
  console.log('  \x1b[1mСВОЯК\x1b[0m — сервер запущен');
  console.log(`\x1b[35m${line}\x1b[0m`);
  console.log(`  Ведущий:      \x1b[36m${publicUrl ?? `http://localhost:${clientPort}`}/host\x1b[0m`);
  console.log(`  Общий экран:  \x1b[36m${publicUrl ?? `http://localhost:${clientPort}`}/board\x1b[0m`);
  console.log(`  API:          http://localhost:${serverPort}/api/health`);

  if (joinUrl) {
    const playersUrl = publicUrl ? `${publicUrl}/join` : joinUrl;
    console.log(`  Игроки:       \x1b[32m${playersUrl}\x1b[0m`);
    if (publicUrl) console.log('  \x1b[2m(внешний адрес из PUBLIC_URL — игра через туннель)\x1b[0m');
    console.log('  \x1b[2mкод комнаты вводится руками; QR с готовым кодом');
    console.log('  покажет экран ведущего после создания комнаты\x1b[0m');
    console.log('\n  Наведите камеру телефона на QR:\n');
    qrcode.generate(publicUrl ? `${publicUrl}/join` : joinUrl, { small: true });
  } else {
    console.log('\n  \x1b[33mЛокальная сеть не найдена — телефоны смогут подключиться');
    console.log('  только через туннель (см. README).\x1b[0m');
  }
  console.log(`\x1b[35m${line}\x1b[0m\n`);
}
