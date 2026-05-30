import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'

const inputLogo = 'public/icons/logo-base.png'
const outputDir = 'public/icons'

// Cambia este color por el fondo de tu app/marca
const backgroundColor = '#0f172a'

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function createIcon(size, outputName, logoScale = 0.9) {
  const logoSize = Math.round(size * logoScale)

  const logoBuffer = await sharp(inputLogo)
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: backgroundColor
    }
  })
    .composite([
      {
        input: logoBuffer,
        gravity: 'center'
      }
    ])
    .png()
    .toFile(path.join(outputDir, outputName))
}

await ensureDir(outputDir)

// Íconos normales: logo más grande
await createIcon(192, 'icon-192.png', 0.9)
await createIcon(512, 'icon-512.png', 0.9)

// Íconos maskable: logo más pequeño, con aire alrededor
await createIcon(192, 'maskable-192.png', 0.68)
await createIcon(512, 'maskable-512.png', 0.68)

console.log('✅ Íconos PWA generados correctamente.')