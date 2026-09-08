import qrcode from 'qrcode-terminal';
import { getLanAddress } from './lan.js';

/** Печатает при старте адреса подключения и QR-код для телефонов. */
export function printBanner(clientPort: number, serverPort: number): void {
  const lan = getLanAddress();
  const joinUrl = lan ? `http://${lan}:${clientPort}/join` : null;

  const line = '─'.repeat(52);
  console.log(`\n\x1b[35m${line}\x1b[0m`);
  console.log('  \x1b[1mСВОЯК\x1b[0m — сервер запущен');
  console.log(`\x1b[35m${line}\x1b[0m`);
  console.log(`  Ведущий:      \x1b[36mhttp://localhost:${clientPort}/host\x1b[0m`);
  console.log(`  Общий экран:  \x1b[36mhttp://localhost:${clientPort}/board\x1b[0m`);
  console.log(`  API:          http://localhost:${serverPort}/api/health`);

  if (joinUrl) {
    console.log(`  Игроки:       \x1b[32m${joinUrl}\x1b[0m`);
    console.log('\n  Наведите камеру телефона на QR:\n');
    qrcode.generate(joinUrl, { small: true });
  } else {
    console.log('\n  \x1b[33mЛокальная сеть не найдена — телефоны смогут подключиться');
    console.log('  только через туннель (см. README).\x1b[0m');
  }
  console.log(`\x1b[35m${line}\x1b[0m\n`);
}
