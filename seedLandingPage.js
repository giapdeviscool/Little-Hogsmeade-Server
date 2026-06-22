const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const existingPage = await prisma.page.findUnique({
    where: { slug: 'landing-page' },
  })

  if (!existingPage) {
    await prisma.page.create({
      data: {
        slug: 'landing-page',
        title: 'Little Hogsmeade',
        content: 'Nơi cà phê, ẩm thực và quầy bar hòa thành một trải nghiệm ấm cúng.',
        imageUrl: null, // to fallback to defaultHero later
        aboutTitle: 'Một câu chuyện ấm áp,\ngói trong từng tách cà phê',
        aboutContent: 'Little Hogsmeade được tạo ra để trở thành nơi bạn chậm lại, thưởng thức một bữa ăn ngon, một ly cà phê được pha kỹ lưỡng hoặc một chai vang chia sẻ cùng người thân.\nNguyên liệu được tuyển chọn từ nhà cung cấp địa phương và nhập khẩu, giữ tinh thần bistro ấm cúng nhưng vẫn đủ tinh tế cho những cuộc hẹn quan trọng.',
        yearsOfExperience: 12,
        isPublished: true,
      },
    })
    console.log('Seeded landing-page successfully')
  } else {
    console.log('landing-page already exists')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
