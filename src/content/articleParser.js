/**
 * Article Parser Module
 * Detects Twitter/X articles and extracts readable content
 *
 * @author groverception (https://github.com/groverception)
 * @license MIT
 * @repository https://github.com/groverception/read-aloud
 */

const ArticleParser = (() => {
  // Debug flag - set to true to enable console logging
  const DEBUG = false;

  // Thresholds for article detection
  const MIN_SINGLE_TWEET_LENGTH = 280; // Single tweet needs to be longer than standard tweet
  const MIN_THREAD_CONTENT_LENGTH = 400; // Thread needs decent content
  const MIN_THREAD_TWEETS = 2; // At least 2 tweets for a thread

  /**
   * Check if current page is a Twitter/X Article or long-form content
   * Shows for: X Articles, long threads, substantial content
   * Hides for: Short single tweets, simple posts with just image/video
   */
  function isArticlePage() {
    const pathname = window.location.pathname;

    // Explicit article URL paths - always show
    const isExplicitArticleUrl = pathname.includes('/article/') || pathname.includes('/i/articles/');
    if (isExplicitArticleUrl) {
      DEBUG && console.log('[Read Aloud] Explicit article URL detected');
      return true;
    }

    // Must be on a status page
    const isStatusUrl = /\/status\/\d+/.test(pathname);
    if (!isStatusUrl) {
      return false;
    }

    // Wait for page to load - need primary column
    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
    if (!primaryColumn) {
      DEBUG && console.log('[Read Aloud] No primary column yet');
      return false;
    }

    // Check 1: Look for X Article/Notes containers
    const articleContainer = document.querySelector('[data-testid="twitterArticleReadView"]') ||
                            document.querySelector('[data-testid="article"]') ||
                            document.querySelector('[data-testid="articleViewer"]') ||
                            document.querySelector('[data-testid="article-cover"]') ||
                            document.querySelector('[data-testid="noteContent"]');

    if (articleContainer) {
      DEBUG && console.log('[Read Aloud] Article container found:', articleContainer.getAttribute('data-testid'));
      return true;
    }

    // Check 2: Look for "Article" label span (X shows this on article pages)
    const allSpans = primaryColumn.querySelectorAll('span');
    for (const span of allSpans) {
      const text = (span.textContent || '').trim();
      if (text === 'Article' || text === 'Notes') {
        DEBUG && console.log('[Read Aloud] Found "Article" label span');
        return true;
      }
    }

    // Check 3: Look for "Show more" button (indicates long content)
    const showMoreLink = document.querySelector('[data-testid="tweet-text-show-more-link"]');
    if (showMoreLink) {
      DEBUG && console.log('[Read Aloud] Show more link found - long content');
      return true;
    }

    // Check 3: Get the main/focal tweet and analyze content
    const mainTweet = getMainTweetElement();
    if (!mainTweet) {
      DEBUG && console.log('[Read Aloud] No main tweet found');
      return false;
    }

    const mainTweetText = mainTweet.querySelector('[data-testid="tweetText"]');
    const mainTextLength = mainTweetText ? (mainTweetText.innerText || '').length : 0;

    // Check 4: Single long tweet (over 280 chars - the standard limit)
    if (mainTextLength > MIN_SINGLE_TWEET_LENGTH) {
      console.log(`[Read Aloud] Long single tweet: ${mainTextLength} chars`);
      return true;
    }

    // Check 5: Thread detection - multiple tweets from same author
    const authorHandle = getAuthorHandle();
    if (authorHandle) {
      const allTweets = primaryColumn.querySelectorAll('article[data-testid="tweet"]');
      let authorTweetCount = 0;
      let totalAuthorContent = 0;

      for (const tweet of allTweets) {
        // Skip quote tweets
        if (tweet.closest('[data-testid="quoteTweet"]')) continue;

        const tweetAuthor = extractAuthorFromElement(tweet);
        if (tweetAuthor === authorHandle) {
          authorTweetCount++;
          const tweetText = tweet.querySelector('[data-testid="tweetText"]');
          if (tweetText) {
            totalAuthorContent += (tweetText.innerText || '').length;
          }
        }
      }

      // Thread: 2+ tweets from author with decent total content
      if (authorTweetCount >= MIN_THREAD_TWEETS && totalAuthorContent >= MIN_THREAD_CONTENT_LENGTH) {
        console.log(`[Read Aloud] Thread: ${authorTweetCount} tweets, ${totalAuthorContent} chars by @${authorHandle}`);
        return true;
      }

      console.log(`[Read Aloud] Not enough content: ${authorTweetCount} tweets, ${totalAuthorContent} chars`);
    }

    // Default: NOT an article (short single tweet)
    DEBUG && console.log('[Read Aloud] Not an article - short single tweet');
    return false;
  }

  /**
   * Get the main/focal tweet element (not replies)
   */
  function getMainTweetElement() {
    // The main tweet is usually the first article within the tweet detail
    const tweetDetail = document.querySelector('[data-testid="tweet"]') ||
                       document.querySelector('[data-testid="tweetDetail"]');

    if (!tweetDetail) {
      // Try getting the first article in primary column
      const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
      if (primaryColumn) {
        return primaryColumn.querySelector('article');
      }
    }

    return tweetDetail;
  }

  /**
   * Extract author from a tweet element
   */
  function extractAuthorFromElement(element) {
    const userNameEl = element.querySelector('[data-testid="User-Name"]');
    if (userNameEl) {
      const handle = userNameEl.querySelector('a[href^="/"]');
      if (handle) {
        const href = handle.getAttribute('href');
        if (href) {
          return href.replace(/^\//, '').split('/')[0].toLowerCase();
        }
      }
    }
    return null;
  }

  /**
   * Quick check if URL looks like an article page (for initial detection)
   * Use this for URL-based checks before DOM is fully loaded
   */
  function isArticleUrl() {
    const pathname = window.location.pathname;
    return /\/status\/\d+/.test(pathname) || pathname.includes('/article/');
  }

  /**
   * Extract article content from the page
   */
  function extractContent() {
    const content = {
      title: '',
      author: '',
      body: '',
      paragraphs: []
    };

    // For Twitter articles (Notes)
    if (window.location.pathname.includes('/article/')) {
      return extractArticleContent(content);
    }

    // For status pages (tweets/threads)
    return extractStatusContent(content);
  }

  /**
   * Extract content from Twitter Article (Notes) pages
   */
  function extractArticleContent(content) {
    // Look for article container
    const articleContainer = document.querySelector('[data-testid="article"]') ||
                            document.querySelector('[data-testid="articleViewer"]') ||
                            document.querySelector('article');

    if (!articleContainer) {
      return extractStatusContent(content);
    }

    // Extract title - articles have clear h1/h2 elements
    const titleEl = articleContainer.querySelector('h1, h2, [role="heading"]');
    if (titleEl) {
      content.title = titleEl.innerText.trim();
    }

    // Extract author
    content.author = extractAuthor();

    // Extract all paragraph content
    const paragraphEls = articleContainer.querySelectorAll('p, [data-testid="tweetText"], div[dir="auto"][lang]');
    const seenText = new Set();

    for (const el of paragraphEls) {
      const text = cleanText(el.innerText);
      if (text && text.length > 10 && !seenText.has(text) && !isUIElement(el, text)) {
        seenText.add(text);
        content.paragraphs.push(text);
      }
    }

    content.body = content.paragraphs.join('\n\n');
    return content;
  }

  /**
   * Extract content from status/tweet pages (threads and articles)
   * Simple approach: use longform-* classes for X Articles
   */
  function extractStatusContent(content) {
    DEBUG && console.log('[Read Aloud] Attempting extractStatusContent...');

    content.author = extractAuthor();
    const paragraphs = [];

    // Look for X Article read view container
    const articleReadView = document.querySelector('[data-testid="twitterArticleReadView"]');
    if (articleReadView) {
      DEBUG && console.log('[Read Aloud] Found twitterArticleReadView container');

      // Simple extraction using longform-* classes
      // These are Twitter's actual article content classes
      const contentElements = articleReadView.querySelectorAll(
        '[class*="longform-"], .public-DraftStyleDefault-ul, .public-DraftStyleDefault-ol'
      );

      DEBUG && console.log('[Read Aloud] Found longform elements:', contentElements.length);

      if (contentElements.length > 0) {
        for (const el of contentElements) {
          // Skip images, videos, embedded tweets
          if (el.closest('[data-testid="card.wrapper"]')) continue;
          if (el.closest('[data-testid="tweetPhoto"]')) continue;
          if (el.closest('[role="link"][href*="/status/"]')) continue;
          if (el.tagName === 'IMG' || el.tagName === 'VIDEO') continue;

          const text = (el.innerText || '').trim();
          if (text && text.length > 0 && !isButtonText(text)) {
            paragraphs.push(text);
          }
        }
      }

      // Fallback: if no longform elements, get all text content from the container
      if (paragraphs.length === 0) {
        DEBUG && console.log('[Read Aloud] No longform elements, using full container text');
        const fullText = articleReadView.innerText || '';
        const lines = fullText.split('\n');

        for (const line of lines) {
          const text = line.trim();
          if (text && text.length > 0 && !isButtonText(text)) {
            paragraphs.push(text);
          }
        }
      }

      if (paragraphs.length > 0) {
        content.paragraphs = paragraphs;
        content.body = paragraphs.join('\n\n');
        DEBUG && console.log('[Read Aloud] Extracted paragraphs:', paragraphs.length);

        // Set title from first short paragraph
        if (paragraphs[0] && paragraphs[0].length < 150) {
          content.title = paragraphs[0];
        }
        return content;
      }
    }

    // Fallback for threads/tweets (non-article pages)
    return extractThreadContent(content);
  }

  /**
   * Check if text is a UI button/action text (very minimal filter)
   */
  function isButtonText(text) {
    const buttonPatterns = [
      /^(Like|Repost|Reply|Share|Bookmark|Copy link|More)$/i,
      /^(\d+\.?\d*[KMB]?)$/i,  // Just numbers like "1.2K"
      /^Follow$/i,
      /^Following$/i,
      /^·$/,
    ];

    for (const pattern of buttonPatterns) {
      if (pattern.test(text.trim())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract content from threads (fallback for non-article pages)
   */
  function extractThreadContent(content) {
    DEBUG && console.log('[Read Aloud] Extracting thread content...');

    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
    if (!primaryColumn) {
      return content;
    }

    const paragraphs = [];
    const seenText = new Set();

    // Get tweet text elements, skip quote tweets
    const tweetTexts = primaryColumn.querySelectorAll('[data-testid="tweetText"]');
    DEBUG && console.log('[Read Aloud] Found tweetText elements:', tweetTexts.length);

    for (const tweetText of tweetTexts) {
      // Skip quote tweets
      if (tweetText.closest('[data-testid="quoteTweet"]')) continue;

      const text = (tweetText.innerText || '').trim();
      if (text && !seenText.has(text)) {
        seenText.add(text);
        paragraphs.push(text);
      }
    }

    content.paragraphs = paragraphs;
    content.body = paragraphs.join('\n\n');

    if (paragraphs[0] && paragraphs[0].length < 150) {
      content.title = paragraphs[0];
    }

    DEBUG && console.log('[Read Aloud] Extracted thread paragraphs:', paragraphs.length);
    return content;
  }

  /**
   * Get the author handle from the URL or page
   */
  function getAuthorHandle() {
    const pathname = window.location.pathname;
    const match = pathname.match(/^\/([^/]+)\//);
    if (match) {
      return match[1].toLowerCase();
    }
    return null;
  }

  /**
   * Extract text from an element, handling Twitter's span structure
   */
  function extractTextFromElement(element) {
    // Twitter wraps text in multiple spans, sometimes with emoji images
    let text = '';

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Handle emoji images with alt text
        if (node.tagName === 'IMG' && node.alt) {
          text += node.alt;
        }
        // Handle line breaks
        if (node.tagName === 'BR') {
          text += '\n';
        }
      }
    }

    return cleanText(text);
  }

  /**
   * Extract author name from the page
   */
  function extractAuthor() {
    // Try data-testid selectors first
    const userNameEl = document.querySelector('[data-testid="User-Name"]');
    if (userNameEl) {
      const nameSpan = userNameEl.querySelector('span > span');
      if (nameSpan && nameSpan.innerText) {
        const name = nameSpan.innerText.trim();
        if (name && !name.startsWith('@')) {
          return name;
        }
      }
    }

    // Try page title
    const pageTitle = document.title;
    const match = pageTitle.match(/^(.+?)\s+(?:on\s+X|\/\s+X):/);
    if (match) {
      return match[1].trim();
    }

    // Try meta tags
    const metaAuthor = document.querySelector('meta[name="author"]');
    if (metaAuthor && metaAuthor.content) {
      return metaAuthor.content;
    }

    return '';
  }

  /**
   * Clean text - remove extra whitespace, normalize
   */
  function cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  /**
   * Check if element is a UI element that should be skipped
   */
  function isUIElement(element, text) {
    // Skip if inside navigation, buttons, etc.
    if (element.closest('nav, footer, button, [role="button"], [role="navigation"]')) {
      return true;
    }

    // Skip very short text (likely UI labels)
    if (text.length < 20) {
      return true;
    }

    // Skip common UI text patterns (only match exact or near-exact)
    const uiPatterns = [
      /^(\d+\.?\d*[KMB]?\s*)?(Repost|Like|View|Reply|Quote|Share|Bookmark|More)s?$/i,
      /^Show more$/i,
      /^Show this thread$/i,
      /^Translate (post|tweet)$/i,
      /^Replying to @\w+$/i,
      /^Follow$/i,
      /^Following$/i,
      /^Promoted$/i,
      /^Ad$/i,
      /^\d+:\d+\s*(AM|PM)$/i,
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+,?\s*\d*$/i,
      /^Read \d+ (replies|reply)$/i,
      /^See new (posts|tweets)$/i,
      /^Who to follow$/i,
      /^Trends for you$/i,
      /^Subscribe$/i,
      /^Get verified$/i
    ];

    // Only skip if it's a SHORT text matching UI patterns
    if (text.length < 50) {
      for (const pattern of uiPatterns) {
        if (pattern.test(text.trim())) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get the full text for TTS reading
   */
  function getReadableText() {
    const content = extractContent();

    // Debug logging
    DEBUG && console.log('[Read Aloud] Extracted content:', content);

    if (!content || content.paragraphs.length === 0) {
      DEBUG && console.log('[Read Aloud] No paragraphs found, trying fallback extraction...');
      // Fallback: try to get any visible text content
      const fallbackContent = extractFallbackContent();
      if (fallbackContent && fallbackContent.paragraphs.length > 0) {
        DEBUG && console.log('[Read Aloud] Fallback found paragraphs:', fallbackContent.paragraphs.length);
        const parts = [];
        if (fallbackContent.author) {
          parts.push(`Article by ${fallbackContent.author}`);
        }
        parts.push(...fallbackContent.paragraphs);
        return parts.join('\n\n');
      }
      return null;
    }

    const parts = [];

    if (content.author) {
      parts.push(`Article by ${content.author}`);
    }

    // Add all paragraphs
    parts.push(...content.paragraphs);

    return parts.join('\n\n');
  }

  /**
   * Fallback extraction - more aggressive text finding
   * Maintains DOM order and skips quote tweets
   */
  function extractFallbackContent() {
    const content = {
      title: '',
      author: '',
      body: '',
      paragraphs: []
    };

    content.author = extractAuthor();
    const seenText = new Set();

    // Get all tweet text elements in DOM order
    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]') || document.querySelector('main');
    if (!primaryColumn) {
      return content;
    }

    // Get tweet texts in order, skipping quotes
    const tweetTexts = primaryColumn.querySelectorAll('[data-testid="tweetText"]');
    DEBUG && console.log('[Read Aloud] Fallback: found tweetText elements:', tweetTexts.length);

    for (const tweetText of tweetTexts) {
      // Skip if inside a quote tweet
      if (tweetText.closest('[data-testid="quoteTweet"]')) {
        continue;
      }

      const text = extractTextFromElement(tweetText);
      if (text && text.length > 20 && !seenText.has(text) && !isUIElement(tweetText, text)) {
        seenText.add(text);
        content.paragraphs.push(text);
      }
    }

    // If still nothing, try broader selectors
    if (content.paragraphs.length === 0) {
      const langElements = primaryColumn.querySelectorAll('div[lang]');
      for (const el of langElements) {
        if (el.closest('[data-testid="quoteTweet"]')) continue;

        const text = extractTextFromElement(el);
        if (text && text.length > 30 && !seenText.has(text) && !isUIElement(el, text)) {
          seenText.add(text);
          content.paragraphs.push(text);
        }
      }
    }

    content.body = content.paragraphs.join('\n\n');
    return content;
  }

  /**
   * Get structured content for transcript display
   */
  function getStructuredContent() {
    return extractContent();
  }

  /**
   * Get paragraph elements for transcript display
   * Returns elements matching the extracted paragraphs
   */
  function getParagraphElements() {
    const elements = [];

    // For X Articles - use longform-* classes
    const articleReadView = document.querySelector('[data-testid="twitterArticleReadView"]');
    if (articleReadView) {
      const contentElements = articleReadView.querySelectorAll(
        '[class*="longform-"], .public-DraftStyleDefault-ul, .public-DraftStyleDefault-ol'
      );

      for (const el of contentElements) {
        // Skip non-content elements
        if (el.closest('[data-testid="card.wrapper"]')) continue;
        if (el.closest('[data-testid="tweetPhoto"]')) continue;
        if (el.tagName === 'IMG' || el.tagName === 'VIDEO') continue;

        const text = (el.innerText || '').trim();
        if (text && text.length > 0 && !isButtonText(text)) {
          elements.push(el);
        }
      }

      if (elements.length > 0) {
        return elements;
      }
    }

    // Fallback for threads
    const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
    if (primaryColumn) {
      const tweetTexts = primaryColumn.querySelectorAll('[data-testid="tweetText"]');
      for (const el of tweetTexts) {
        if (el.closest('[data-testid="quoteTweet"]')) continue;
        elements.push(el);
      }
    }

    return elements;
  }

  // Public API
  return {
    isArticlePage,
    extractContent,
    getReadableText,
    getStructuredContent,
    getParagraphElements
  };
})();

// Export for content script
if (typeof window !== 'undefined') {
  window.ArticleParser = ArticleParser;
}
