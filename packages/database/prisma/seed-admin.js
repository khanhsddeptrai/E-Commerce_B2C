const path = require('path');
const fs = require('fs');

// 1. Nạp cấu hình biến môi trường .env
const envPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(process.cwd(), '.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    try {
      require('dotenv').config({ path: p });
    } catch {}
  }
}

// 2. Nạp bcryptjs
let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch {
  bcrypt = require(path.resolve(__dirname, '../../../apps/auth-service/node_modules/bcryptjs'));
}

// 3. Nạp PrismaClient cho auth_db
let PrismaClient;
try {
  PrismaClient = require('@prisma/client').PrismaClient;
} catch {
  PrismaClient = require(path.resolve(__dirname, '../node_modules/@prisma/client')).PrismaClient;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.AUTH_DATABASE_URL ||
        'postgresql://postgres:postgrespassword@localhost:5432/auth_db?schema=public',
    },
  },
});

async function main() {
  console.log('>>> [Seed Admin] Bắt đầu khởi tạo tài khoản Quản trị viên (ADMIN)...');

  const passwordRaw = '123456';
  const passwordHash = await bcrypt.hash(passwordRaw, 10);

  // Danh sách tài khoản admin cần khởi tạo / đồng bộ
  const adminAccounts = [
    {
      email: 'admin@novatech.com',
      fullName: 'Quản Trị Viên Hệ Thống',
      phone: '0901234567',
    },
    {
      email: 'khanhkg9a4@gmail.com',
      fullName: 'Nguyễn Duy Khánh',
      phone: '0988888888',
    },
  ];

  for (const acc of adminAccounts) {
    const existing = await prisma.user.findUnique({
      where: { email: acc.email },
    });

    if (existing) {
      const updated = await prisma.user.update({
        where: { email: acc.email },
        data: {
          role: 'ADMIN',
          status: 'ACTIVE',
          passwordHash: passwordHash,
          fullName: acc.fullName || existing.fullName,
        },
      });
      console.log(`✓ Đã cập nhật tài khoản [${updated.email}] -> Quyền: ADMIN | Mật khẩu: ${passwordRaw}`);
    } else {
      const created = await prisma.user.create({
        data: {
          email: acc.email,
          fullName: acc.fullName,
          phone: acc.phone,
          passwordHash: passwordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });
      console.log(`✓ Đã tạo mới tài khoản [${created.email}] -> Quyền: ADMIN | Mật khẩu: ${passwordRaw}`);
    }
  }

  console.log('\n>>> [Seed Admin] Hoàn tất! Danh sách tài khoản Admin sẵn sàng:');
  const allAdmins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, fullName: true, role: true, status: true },
  });
  console.table(allAdmins);
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed tài khoản Admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
