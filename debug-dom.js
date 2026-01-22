/**
 * Debug script - Run this in browser console on a Twitter article page
 * Copy and paste this entire script into the console (F12 -> Console)
 */

(function() {
  console.log('=== Read Aloud DOM Analysis ===\n');

  // 1. URL Analysis
  console.log('1. URL INFO:');
  console.log('   Pathname:', window.location.pathname);
  console.log('   Is /status/ URL:', /\/status\/\d+/.test(window.location.pathname));
  console.log('   Is /article/ URL:', window.location.pathname.includes('/article/'));

  // 2. Key containers
  console.log('\n2. KEY CONTAINERS:');
  const containers = [
    '[data-testid="primaryColumn"]',
    '[data-testid="tweetDetail"]',
    '[data-testid="tweet"]',
    '[data-testid="article"]',
    '[data-testid="articleViewer"]',
    'main',
    'article',
    '[data-testid="cellInnerDiv"]'
  ];

  containers.forEach(sel => {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) {
      console.log(`   ${sel}: ${els.length} found`);
    }
  });

  // 3. Tweet text elements
  console.log('\n3. TWEET TEXT ELEMENTS:');
  const tweetTexts = document.querySelectorAll('[data-testid="tweetText"]');
  console.log('   [data-testid="tweetText"]:', tweetTexts.length, 'found');

  if (tweetTexts.length > 0) {
    console.log('\n   Sample content from tweetText elements:');
    tweetTexts.forEach((el, i) => {
      const text = el.innerText.trim().substring(0, 100);
      console.log(`   [${i}] (${el.innerText.length} chars): "${text}..."`);
    });
  }

  // 4. Lang/dir attributed elements
  console.log('\n4. LANG/DIR ELEMENTS:');
  const langDivs = document.querySelectorAll('div[lang]');
  const langSpans = document.querySelectorAll('span[lang]');
  console.log('   div[lang]:', langDivs.length);
  console.log('   span[lang]:', langSpans.length);

  // 5. Article elements analysis
  console.log('\n5. ARTICLE ELEMENT ANALYSIS:');
  const articles = document.querySelectorAll('article');
  console.log('   Total <article> elements:', articles.length);

  articles.forEach((article, i) => {
    const tweetText = article.querySelector('[data-testid="tweetText"]');
    const textContent = tweetText ? tweetText.innerText.trim() : '';
    const hasUser = article.querySelector('[data-testid="User-Name"]');
    const time = article.querySelector('time');

    console.log(`   Article[${i}]:`);
    console.log(`     - Has tweetText: ${!!tweetText} (${textContent.length} chars)`);
    console.log(`     - Has User-Name: ${!!hasUser}`);
    console.log(`     - Has time: ${!!time} ${time ? '(' + time.getAttribute('datetime') + ')' : ''}`);
    if (textContent.length > 0) {
      console.log(`     - Preview: "${textContent.substring(0, 80)}..."`);
    }
  });

  // 6. Thread detection (same author multiple posts)
  console.log('\n6. THREAD DETECTION:');
  const userNames = document.querySelectorAll('[data-testid="User-Name"]');
  const authors = new Set();
  userNames.forEach(el => {
    const handle = el.querySelector('a[href^="/"]');
    if (handle) authors.add(handle.getAttribute('href'));
  });
  console.log('   Unique authors found:', authors.size);
  console.log('   Authors:', [...authors].join(', '));

  // 7. Content length analysis
  console.log('\n7. CONTENT LENGTH ANALYSIS:');
  let totalTextLength = 0;
  tweetTexts.forEach(el => {
    totalTextLength += el.innerText.length;
  });
  console.log('   Total text content length:', totalTextLength, 'characters');
  console.log('   Average per tweetText:', Math.round(totalTextLength / Math.max(tweetTexts.length, 1)), 'chars');
  console.log('   Likely article/thread:', totalTextLength > 500 ? 'YES' : 'NO');

  // 8. Special elements that indicate long-form content
  console.log('\n8. LONG-FORM INDICATORS:');
  const indicators = {
    'Show more button': '[data-testid="tweet-text-show-more-link"]',
    'Thread line': '[data-testid="tweet-thread-line"]',
    'Conversation controls': '[data-testid="inlineConversationControl"]',
    'View count': '[data-testid="analyticsButton"]',
    'Quote tweet': '[data-testid="quoteTweet"]'
  };

  Object.entries(indicators).forEach(([name, sel]) => {
    const found = document.querySelectorAll(sel).length;
    if (found > 0) console.log(`   ${name}: ${found} found`);
  });

  // 9. Primary column analysis
  console.log('\n9. PRIMARY COLUMN STRUCTURE:');
  const primaryCol = document.querySelector('[data-testid="primaryColumn"]');
  if (primaryCol) {
    const sections = primaryCol.querySelectorAll('section');
    const cells = primaryCol.querySelectorAll('[data-testid="cellInnerDiv"]');
    console.log('   Sections:', sections.length);
    console.log('   Cell divs:', cells.length);
  }

  // 10. Recommendation
  console.log('\n10. RECOMMENDATION:');
  const isArticle = totalTextLength > 500 || tweetTexts.length > 2;
  console.log('   Should show Read Aloud:', isArticle ? 'YES' : 'NO');
  console.log('   Reason:', isArticle
    ? `Content length (${totalTextLength}) or multiple tweets (${tweetTexts.length})`
    : 'Not enough content to read'
  );

  console.log('\n=== END ANALYSIS ===');

  // Return summary object
  return {
    url: window.location.pathname,
    tweetTextCount: tweetTexts.length,
    totalContentLength: totalTextLength,
    articleCount: articles.length,
    uniqueAuthors: authors.size,
    isLikelyArticle: isArticle
  };
})();
