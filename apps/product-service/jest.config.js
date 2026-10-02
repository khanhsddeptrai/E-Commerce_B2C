/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }],
  },
  // Trỏ biến môi trường sang product_db_test + Redis DB riêng trước khi import bất kỳ module nào
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  // Tạo database test (nếu chưa có) và dựng lại schema sạch một lần trước khi chạy
  globalSetup: '<rootDir>/test/global-setup.ts',
  // Các test dùng chung một database nên chạy tuần tự
  maxWorkers: 1,
};
