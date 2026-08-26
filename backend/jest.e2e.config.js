module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.integration.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  maxWorkers: 1,
};
