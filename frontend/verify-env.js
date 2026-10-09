/**
 * Environment Variable Verification Script
 * Run this to check if all Firebase variables are properly loaded
 * Usage: node verify-env.js
 */

const requiredVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'GEMINI_API_KEY'
];

console.log('🔍 Checking environment variables...\n');

let allPresent = true;
const results = [];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  const isPresent = !!value;
  
  if (!isPresent) {
    allPresent = false;
    results.push(`❌ ${varName}: MISSING`);
  } else {
    const maskedValue = value.substring(0, 10) + '...';
    results.push(`✅ ${varName}: ${maskedValue}`);
  }
});

results.forEach(result => console.log(result));

console.log('\n' + '='.repeat(60));

if (allPresent) {
  console.log('✅ All environment variables are present!');
  console.log('🚀 You can now run: npm run dev');
} else {
  console.log('❌ Some environment variables are missing!');
  console.log('\n📝 To fix:');
  console.log('1. Check that .env.local exists in the frontend folder');
  console.log('2. Make sure all variables start with NEXT_PUBLIC_');
  console.log('3. Restart your dev server after making changes');
  console.log('4. Run this script again to verify');
}

console.log('='.repeat(60) + '\n');
