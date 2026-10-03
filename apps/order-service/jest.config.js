/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }],
  },
  // Trỏ database / Redis sang bản dành riêng cho test trước khi import bất kỳ module nào
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  // Tạo mới order_db_ordersvc_test và áp dụng migrations thật một lần trước khi chạy
  globalSetup: '<rootDir>/test/global-setup.ts',
  maxWorkers: 1,
};
