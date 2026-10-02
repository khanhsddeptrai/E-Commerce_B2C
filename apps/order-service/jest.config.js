/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }],
  },
  // Trỏ Redis sang DB riêng cho test trước khi import bất kỳ module nào
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  maxWorkers: 1,
};
