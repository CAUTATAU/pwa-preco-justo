// Homologação: gera o build, serve com `vite preview` (que repassa /api para o
// backend local) e abre um túnel ngrok HTTPS para o front. Uma URL só para tudo.
//   npm run homolog            (build + preview + ngrok)
//   npm run homolog -- --skip-build
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const port = process.env.HOMOLOG_PORT || '4173'
const domain = process.env.NGROK_DOMAIN
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))

if (!process.argv.includes('--skip-build')) {
  const build = spawnSync('npm run build', { stdio: 'inherit', shell: true })
  if (build.status) process.exit(build.status)
}

const preview = spawn(process.execPath, [viteBin, 'preview', '--port', port, '--strictPort'], { stdio: 'inherit' })

const ngrokArgs = ['http', port, '--log=false']
if (domain) ngrokArgs.push(`--url=${domain}`)
const ngrok = spawn('ngrok', ngrokArgs, { stdio: ['ignore', 'ignore', 'inherit'] })
ngrok.on('error', () => {
  console.error('\n❌ ngrok não encontrado. Instale em https://ngrok.com/download e rode `ngrok config add-authtoken <token>`.')
  stop(1)
})

// Mostra a URL pública assim que o túnel subir (painel local do ngrok)
const showUrl = async (attempt = 0) => {
  try {
    const res = await fetch('http://127.0.0.1:4040/api/tunnels')
    const { tunnels } = await res.json()
    const url = tunnels.find((t) => t.public_url?.startsWith('https'))?.public_url
    if (!url) throw new Error()
    console.log(`\n✅ App no ar: ${url}`)
    console.log('   Painel do ngrok: http://localhost:4040')
    console.log('   (o backend precisa estar rodando em http://localhost:3333)\n')
  } catch {
    if (attempt < 20) setTimeout(() => showUrl(attempt + 1), 1000)
    else console.error('\n⚠️  Não foi possível ler a URL do ngrok. Veja http://localhost:4040')
  }
}
setTimeout(showUrl, 1500)

let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  preview.kill()
  ngrok.kill()
  process.exit(code)
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
preview.on('exit', (code) => stop(code ?? 0))
ngrok.on('exit', (code) => stop(code ?? 0))
