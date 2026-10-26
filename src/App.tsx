import React, { useState, useEffect } from 'react';
import restaurantHero from './assets/images/restaurant_hero.jpg';

// Data shapes matching the exact backend contract
interface FoodItem {
  name: string;
  isVeg: boolean;
}

interface ReviewItem {
  id: number;
  rating: number;
  comment: string;
  foodItems?: FoodItem[];
  createdAt: string;
}

interface RestaurantResponse {
  name: string;
  cuisine: string;
  area: string;
  averageRating: number | null;
  totalReviews: number;
  ratingBreakdown: Record<number, number>;
  latestReview: ReviewItem | null;
  reviews: ReviewItem[];
}

interface AiSummaryResponse {
  available: boolean;
  summary: string;
  dishHighlights: string[];
  whatDinersLove: string[];
  headsUp: string;
}

// Iconic Indian FSSAI Veg / Non-Veg Badges
export const VegIcon = () => (
  <span
    title="Vegetarian"
    className="inline-flex items-center justify-center w-3.5 h-3.5 border border-emerald-600 rounded-[3px] p-[2px] bg-white shrink-0"
  >
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
  </span>
);

export const NonVegIcon = () => (
  <span
    title="Non-Vegetarian"
    className="inline-flex items-center justify-center w-3.5 h-3.5 border border-rose-700 rounded-[3px] p-[2px] bg-white shrink-0"
  >
    <span className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-rose-700"></span>
  </span>
);

export const MobileStatusBar = () => (
  <div className="bg-white text-stone-900 px-6 pt-3 pb-1.5 flex items-center justify-between text-xs font-semibold select-none shrink-0 relative z-30">
    <span className="text-[13px] font-bold tracking-tight">9:41</span>
    <div className="w-24 h-5 bg-black rounded-full flex items-center justify-between px-2.5">
      <span className="w-2 h-2 rounded-full bg-stone-900 border border-stone-800"></span>
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-950/80"></span>
    </div>
    <div className="flex items-center gap-1.5 text-stone-800">
      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
        <path d="M2 18h2v2H2zm4-4h2v6H6zm4-4h2v10h-2zm4-4h2v14h-2zm4-4h2v18h-2z" />
      </svg>
      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
        <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4zm0 2.22c3.84 0 7.33 1.48 9.97 3.91l-9.97 9.99-9.97-9.99C4.67 7.7 8.16 6.22 12 6.22z" />
      </svg>
      <div className="w-5 h-2.5 border border-stone-800 rounded-[3px] p-[1px] flex items-center">
        <div className="w-full h-full bg-stone-900 rounded-[1px]"></div>
      </div>
    </div>
  </div>
);

export const MobileHomeBar = () => (
  <div className="bg-white py-2 flex items-center justify-center shrink-0 border-t border-stone-100 z-30">
    <div className="w-32 h-1 bg-stone-900/35 rounded-full"></div>
  </div>
);

export default function App() {
  // Simple path routing supporting both /restaurant/:id and /review/:id
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const p = window.location.pathname;
    if (p.startsWith('/review/')) return p;
    if (p.startsWith('/restaurant/')) return p;
    return '/restaurant/1';
  });

  const [restaurantId, setRestaurantId] = useState<number>(1);
  const [screen, setScreen] = useState<'restaurant' | 'review'>('restaurant');
  const [isMobileFrame, setIsMobileFrame] = useState<boolean>(true);

  // Architecture inspector toggle for the PM session
  const [showInspector, setShowInspector] = useState<boolean>(false);
  const [curlTestResult, setCurlTestResult] = useState<string | null>(null);
  const [isTestingCurl, setIsTestingCurl] = useState<boolean>(false);

  // Sync state with path
  useEffect(() => {
    if (currentPath.startsWith('/review/')) {
      const id = parseInt(currentPath.replace('/review/', ''), 10) || 1;
      setRestaurantId(id);
      setScreen('review');
    } else {
      const id = parseInt(currentPath.replace('/restaurant/', ''), 10) || 1;
      setRestaurantId(id);
      setScreen('restaurant');
    }
    // Update browser URL quietly without full reload
    if (window.location.pathname !== currentPath) {
      window.history.pushState({}, '', currentPath);
    }
  }, [currentPath]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      if (p.startsWith('/review/') || p.startsWith('/restaurant/')) {
        setCurrentPath(p);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    setCurrentPath(path);
  };

  // Helper to format ISO date nicely
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  // ==========================================
  // SCREEN 2: /restaurant/[id]
  // ==========================================
  const RestaurantScreen = () => {
    const [data, setData] = useState<RestaurantResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Zomato AI state
    const [aiSummary, setAiSummary] = useState<AiSummaryResponse | null>(null);
    const [aiLoading, setAiLoading] = useState<boolean>(false);
    const [customQuestion, setCustomQuestion] = useState<string>('');
    const [aiAnswer, setAiAnswer] = useState<string | null>(null);
    const [askingAi, setAskingAi] = useState<boolean>(false);

    const loadRestaurant = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/restaurants/${restaurantId}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Error ${res.status}: Failed to load`);
        }
        const json: RestaurantResponse = await res.json();
        // Notice: The frontend receives the shape directly from the backend.
        // It does not calculate, sum, divide, or sort.
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const loadAiSummary = async () => {
      setAiLoading(true);
      try {
        const res = await fetch(`/api/restaurants/${restaurantId}/ai-summary`);
        if (res.ok) {
          const json: AiSummaryResponse = await res.json();
          setAiSummary(json);
        }
      } catch (err) {
        console.warn('AI summary error:', err);
      } finally {
        setAiLoading(false);
      }
    };

    const handleAskAi = async (questionToAsk?: string) => {
      const q = (questionToAsk || customQuestion).trim();
      if (!q) return;
      setAskingAi(true);
      setAiAnswer(null);
      try {
        const res = await fetch(`/api/restaurants/${restaurantId}/ai-ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
        });
        const resData = await res.json();
        setAiAnswer(resData.answer || 'No answer available.');
      } catch (err: any) {
        setAiAnswer('Unable to reach Foodie AI right now.');
      } finally {
        setAskingAi(false);
      }
    };

    useEffect(() => {
      loadRestaurant();
      loadAiSummary();
    }, [restaurantId]);

    if (loading) {
      return (
        <div className="py-20 text-center">
          <p className="text-sm text-stone-500 font-mono">Loading restaurant data from backend...</p>
        </div>
      );
    }

    if (error || !data) {
      return (
        <div className="py-16 text-center">
          <p className="text-sm text-rose-700 font-medium mb-3">{error || 'Restaurant not found'}</p>
          <button
            onClick={() => {
              setRestaurantId(1);
              navigateTo('/restaurant/1');
            }}
            className="text-xs text-[#e23744] underline font-medium hover:text-[#cb202d]"
          >
            Go back to Indian Cuisine (Restaurant #1)
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Restaurant Hero Image with Zomato badge */}
        <div className="overflow-hidden rounded-2xl border border-stone-200 shadow-sm bg-stone-100 relative group">
          <img
            src={restaurantHero}
            alt={`${data.name} in ${data.area}`}
            className="w-full h-60 object-cover object-center group-hover:scale-[1.01] transition-transform duration-300"
          />
          <div className="absolute top-3 left-3 bg-[#e23744] text-white px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wider shadow-sm flex items-center gap-1">
            <span>zomato</span>
            <span className="text-[10px] opacity-90 font-normal">dining</span>
          </div>
          <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-md text-[11px] text-white/95 font-medium">
            Karol Bagh, New Delhi
          </div>
        </div>

        {/* 1. Restaurant Header */}
        <header className="border-b border-stone-200 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                {data.name}
              </h1>
              <p className="text-xs text-stone-500 mt-1.5 flex items-center gap-2">
                <span className="font-medium text-stone-700">{data.cuisine}</span>
                <span className="text-stone-300">·</span>
                <span>{data.area}</span>
              </p>
            </div>
            <button
              onClick={() => navigateTo(`/review/${restaurantId}`)}
              className="px-4 py-2 text-xs font-semibold bg-[#e23744] hover:bg-[#cb202d] text-white rounded-lg shadow-sm transition-all duration-150 active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <span>+</span>
              <span>Add Review</span>
            </button>
          </div>
        </header>

        {/* 2. Sleek Rating Breakdown Card - Zomato Red & White Theme */}
        <section className="bg-white border border-red-100 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Left: Big Rating Number and 'out of 5' in Zomato Red */}
            <div className="flex flex-col items-center justify-center sm:pr-6 sm:border-r sm:border-red-100 text-center shrink-0 min-w-[120px]">
              {data.averageRating !== null ? (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-6xl font-black text-[#e23744] tracking-tight">
                      {data.averageRating}
                    </span>
                    <span className="text-2xl font-bold text-[#e23744]">★</span>
                  </div>
                  <span className="text-xs text-stone-500 font-semibold mt-1">
                    out of 5
                  </span>
                </>
              ) : (
                <span className="text-sm text-stone-500 italic">No ratings</span>
              )}
            </div>

            {/* Right: Horizontal Rating Bars for 5, 4, 3, 2, 1 in Zomato Red */}
            <div className="flex-1 w-full space-y-2.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = data.ratingBreakdown?.[star] || 0;
                const percentage =
                  data.totalReviews > 0 ? (count / data.totalReviews) * 100 : 0;

                return (
                  <div key={star} className="flex items-center gap-3 text-xs">
                    <span className="font-bold text-stone-700 w-3 text-center">
                      {star}
                    </span>
                    <div className="flex-1 h-2.5 rounded-full bg-red-50 border border-red-100/70 overflow-hidden relative">
                      <div
                        className="h-full rounded-full bg-[#e23744] transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="font-semibold text-stone-600 w-5 text-right font-mono">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-red-100 flex items-center justify-between text-[11px] text-stone-500">
            <span>Based on {data.totalReviews} customer dining reviews</span>
            <span className="flex items-center gap-1.5 font-medium text-[#e23744]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e23744]"></span>
              <span>100% verified diners</span>
            </span>
          </div>
        </section>

        {/* 3. Zomato Foodie AI Digest */}
        <section className="rounded-2xl border border-red-200/80 bg-linear-to-b from-red-50/50 to-white p-4 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e23744] animate-pulse"></span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#e23744]">
                Zomato Foodie AI
              </h2>
            </div>
            <span className="text-[10px] bg-red-100/70 text-[#e23744] font-medium px-2 py-0.5 rounded-full">
              Review Intelligence
            </span>
          </div>

          {aiLoading ? (
            <p className="text-xs text-stone-500 font-mono">Synthesizing review sentiment with AI...</p>
          ) : aiSummary ? (
            <div className="space-y-3 text-xs">
              <p className="text-stone-800 leading-relaxed font-medium">
                "{aiSummary.summary}"
              </p>

              {/* Dish Highlights */}
              {aiSummary.dishHighlights?.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-stone-700">Top Mentioned Dishes:</span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {aiSummary.dishHighlights.map((dish, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center text-[11px] font-medium bg-white border border-red-200 text-stone-800 px-2.5 py-1 rounded-md shadow-2xs"
                      >
                        {dish}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Heads-up / Nuance */}
              {aiSummary.headsUp && (
                <div className="pt-1 text-[11px] text-stone-700 flex items-baseline gap-1.5 bg-red-50/60 p-2 rounded-lg border border-red-100">
                  <span className="font-bold text-[#e23744]">Heads up:</span>
                  <span>{aiSummary.headsUp}</span>
                </div>
              )}
            </div>
          ) : null}

          {/* Interactive "Ask Foodie AI" */}
          <div className="pt-2 border-t border-red-100 space-y-2">
            <p className="text-[11px] font-semibold text-stone-700">Ask Foodie AI anything about this place:</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'What is the most recommended dish?',
                'How is the service speed?',
                'Is it worth repeating?',
              ].map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setCustomQuestion(q);
                    handleAskAi(q);
                  }}
                  className="text-[11px] bg-white hover:bg-red-50/50 hover:border-[#e23744]/40 text-stone-700 border border-stone-200 px-2.5 py-1 rounded-md transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskAi();
              }}
              className="flex gap-2 pt-1"
            >
              <input
                type="text"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder="Ask e.g. 'Is the paneer burrito good?'"
                className="flex-1 text-xs bg-white border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:border-[#e23744] focus:ring-1 focus:ring-[#e23744]"
              />
              <button
                type="submit"
                disabled={askingAi || !customQuestion.trim()}
                className="px-3.5 py-2 text-xs font-semibold bg-[#e23744] hover:bg-[#cb202d] text-white rounded-lg disabled:bg-stone-300 transition-colors shrink-0"
              >
                {askingAi ? 'Thinking...' : 'Ask AI'}
              </button>
            </form>

            {aiAnswer && (
              <div className="mt-2 text-xs p-3 bg-white border border-red-200 rounded-lg text-stone-800 leading-relaxed shadow-xs">
                <span className="font-bold text-[#e23744]">Foodie AI: </span>
                {aiAnswer}
              </div>
            )}
          </div>
        </section>

        {/* 4. Empty State or Reviews Section */}
        {data.totalReviews === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center bg-white">
            <p className="text-sm text-stone-700 font-medium mb-1">Be the first to review this place.</p>
            <p className="text-xs text-stone-400 mb-4">No reviews have been submitted yet.</p>
            <button
              onClick={() => navigateTo(`/review/${restaurantId}`)}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-[#e23744] hover:bg-[#cb202d] rounded-lg transition-colors"
            >
              Write the first review
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Latest Review: Visually highlighted with Zomato Red accent and Tagged Food Items */}
            {data.latestReview && (
              <section className="rounded-xl border-l-4 border-l-[#e23744] border-y border-r border-stone-200 bg-white p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#24963f] text-white text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <span>{data.latestReview.rating}</span>
                      <span>★</span>
                    </span>
                    <span className="text-[11px] font-semibold text-[#e23744]">Latest review</span>
                  </div>
                  <span className="text-[11px] text-stone-400">
                    {formatDate(data.latestReview.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-stone-800 leading-relaxed font-normal">
                  "{data.latestReview.comment}"
                </p>

                {/* Tagged food items with Veg / Non-Veg icon */}
                {data.latestReview.foodItems && data.latestReview.foodItems.length > 0 && (
                  <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-stone-400 mr-1">
                      Ordered:
                    </span>
                    {data.latestReview.foodItems.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-stone-50 border border-stone-200 text-stone-800 px-2 py-0.5 rounded-md"
                      >
                        {item.isVeg ? <VegIcon /> : <NonVegIcon />}
                        <span>{item.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Older Reviews: Plain list with tagged Veg/Non-Veg dishes */}
            {data.reviews.length > 0 && (
              <section className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Older reviews ({data.reviews.length})
                </h3>
                <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 overflow-hidden shadow-xs">
                  {data.reviews.map((r) => (
                    <article key={r.id} className="p-3.5 hover:bg-stone-50/50 transition-colors space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="bg-[#24963f] text-white text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <span>{r.rating}</span>
                          <span>★</span>
                        </span>
                        <span className="text-[11px] text-stone-400">
                          {formatDate(r.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed">
                        {r.comment}
                      </p>

                      {/* Tagged food items */}
                      {r.foodItems && r.foodItems.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {r.foodItems.map((item, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-stone-50 border border-stone-200 text-stone-800 px-2 py-0.5 rounded-md"
                            >
                              {item.isVeg ? <VegIcon /> : <NonVegIcon />}
                              <span>{item.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Fixed bottom action bar pinned to the bottom of the screen */}
            <div className="sticky bottom-0 -mx-4 -mb-5 px-4 py-3 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-[0_-4px_16px_rgba(0,0,0,0.07)] z-20">
              <button
                onClick={() => navigateTo(`/review/${restaurantId}`)}
                className="w-full py-3.5 px-4 text-xs font-bold text-white bg-[#e23744] hover:bg-[#cb202d] rounded-xl shadow-md transition-all duration-150 active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>✍️</span>
                <span>Write a review</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // SCREEN 1: /review/[restaurantId]
  // ==========================================
  const ReviewScreen = () => {
    const [restaurantName, setRestaurantName] = useState<string>('Indian Cuisine');
    const [rating, setRating] = useState<number | null>(null);
    const [comment, setComment] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState<boolean>(false);

    // Food items tagging state
    const [selectedFoodItems, setSelectedFoodItems] = useState<FoodItem[]>([
      { name: 'Paneer Burrito', isVeg: true },
    ]);
    const [newDishName, setNewDishName] = useState<string>('');
    const [newDishIsVeg, setNewDishIsVeg] = useState<boolean>(true);

    // Preset dishes commonly ordered
    const presetDishes: FoodItem[] = [
      { name: 'Paneer Burrito', isVeg: true },
      { name: 'Chicken Tikka Burrito', isVeg: false },
      { name: 'Dal Makhani & Naan', isVeg: true },
      { name: 'Sensational Salsa Dip', isVeg: true },
      { name: 'Butter Chicken Wrap', isVeg: false },
      { name: 'Tandoori Paneer Roll', isVeg: true },
    ];

    // Fetch restaurant name to show at the top
    useEffect(() => {
      fetch(`/api/restaurants/${restaurantId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.name) {
            setRestaurantName(data.name);
          }
        })
        .catch(() => {});
    }, [restaurantId]);

    const togglePresetDish = (item: FoodItem) => {
      const exists = selectedFoodItems.some((f) => f.name === item.name);
      if (exists) {
        setSelectedFoodItems(selectedFoodItems.filter((f) => f.name !== item.name));
      } else {
        setSelectedFoodItems([...selectedFoodItems, item]);
      }
    };

    const addCustomDish = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = newDishName.trim();
      if (!trimmed) return;
      if (!selectedFoodItems.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
        setSelectedFoodItems([...selectedFoodItems, { name: trimmed, isVeg: newDishIsVeg }]);
      }
      setNewDishName('');
    };

    const removeFoodItem = (name: string) => {
      setSelectedFoodItems(selectedFoodItems.filter((f) => f.name !== name));
    };

    // Submit disabled until rating is picked (1 to 5) and comment is non-empty after trimming
    const isValid = rating !== null && rating >= 1 && rating <= 5 && comment.trim().length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValid || submitting) return;

      setSubmitting(true);
      setErrorMessage(null);

      try {
        const response = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId: restaurantId,
            rating: rating,
            comment: comment.trim(),
            foodItems: selectedFoodItems,
          }),
        });

        const resData = await response.json();

        if (!response.ok) {
          setErrorMessage(resData.error || 'Submission failed');
          setSubmitting(false);
          return;
        }

        // On success: send to /restaurant/[id]
        navigateTo(`/restaurant/${restaurantId}`);
      } catch (err: any) {
        setErrorMessage(err.message || 'Network error occurred');
        setSubmitting(false);
      }
    };

    return (
      <div className="space-y-6">
        {/* Navigation back */}
        <button
          onClick={() => navigateTo(`/restaurant/${restaurantId}`)}
          className="text-xs font-medium text-[#e23744] hover:text-[#cb202d] transition-colors flex items-center gap-1"
        >
          ← Back to restaurant
        </button>

        {/* 1. Header: The restaurant name at the top */}
        <header className="border-b border-stone-200 pb-4">
          <p className="text-xs uppercase tracking-wider text-[#e23744] font-bold">Write a Review</p>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">{restaurantName}</h1>
          <p className="text-xs text-stone-500 mt-0.5">Share your rating and the dishes you enjoyed</p>
        </header>

        {/* Error message from backend */}
        {errorMessage && (
          <div className="p-3 text-xs bg-red-50 border border-red-200 text-[#e23744] rounded-lg font-medium">
            <span className="font-bold">Backend rejected: </span>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          {/* 2. Star Picker: 1 to 5, clickable, clear selected state */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-2.5">
              How would you rate your food? (1 to 5)
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className={`w-12 h-12 text-lg font-bold rounded-xl border transition-all duration-150 flex items-center justify-center ${
                    rating !== null && rating >= star
                      ? 'bg-[#e23744] text-white border-[#e23744] shadow-sm scale-105'
                      : 'bg-white text-stone-500 border-stone-300 hover:border-[#e23744] hover:text-[#e23744]'
                  }`}
                  aria-label={`${star} star`}
                >
                  {star}★
                </button>
              ))}
            </div>
            {rating && (
              <p className="text-[11px] font-medium text-[#e23744] mt-2">
                You selected {rating} star{rating > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* 3. Food Items Tagging with Veg / Non-Veg Icon */}
          <div className="space-y-3 pt-1 border-t border-stone-100">
            <div>
              <label className="block text-xs font-bold text-stone-800">
                Tag dishes you ordered
              </label>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Pick popular items or add a custom item with Veg/Non-Veg indicator
              </p>
            </div>

            {/* Preset Dish Toggles */}
            <div className="flex flex-wrap gap-1.5">
              {presetDishes.map((dish, i) => {
                const isSelected = selectedFoodItems.some((f) => f.name === dish.name);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => togglePresetDish(dish)}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-red-50 border-[#e23744] text-[#e23744]'
                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {dish.isVeg ? <VegIcon /> : <NonVegIcon />}
                    <span>{dish.name}</span>
                    <span className="text-[10px] ml-0.5">{isSelected ? '✓' : '+'}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Dish Addition */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setNewDishIsVeg(!newDishIsVeg)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors shrink-0 ${
                  newDishIsVeg
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}
                title="Click to toggle Veg / Non-Veg"
              >
                {newDishIsVeg ? <VegIcon /> : <NonVegIcon />}
                <span>{newDishIsVeg ? 'Veg' : 'Non-Veg'}</span>
              </button>

              <input
                type="text"
                value={newDishName}
                onChange={(e) => setNewDishName(e.target.value)}
                placeholder="Add other dish name..."
                className="flex-1 text-xs bg-white border border-stone-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#e23744]"
              />

              <button
                type="button"
                onClick={addCustomDish}
                disabled={!newDishName.trim()}
                className="px-3 py-1.5 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-lg disabled:bg-stone-200 transition-colors"
              >
                Add
              </button>
            </div>

            {/* Selected items summary */}
            {selectedFoodItems.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1.5">
                  Selected to tag ({selectedFoodItems.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedFoodItems.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-white border border-stone-300 text-stone-800 px-2.5 py-1 rounded-md shadow-2xs"
                    >
                      {item.isVeg ? <VegIcon /> : <NonVegIcon />}
                      <span>{item.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFoodItem(item.name)}
                        className="text-stone-400 hover:text-rose-600 font-bold ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Comment Box */}
          <div className="pt-1 border-t border-stone-100">
            <label htmlFor="comment" className="block text-xs font-bold text-stone-800 mb-2">
              Review Comment
            </label>
            <textarea
              id="comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell others what you loved about the food, service, and ambiance..."
              className="w-full text-xs text-stone-900 bg-white border border-stone-300 rounded-xl p-3 focus:outline-none focus:border-[#e23744] focus:ring-1 focus:ring-[#e23744] transition-colors placeholder:text-stone-400 leading-relaxed"
            />
          </div>

          {/* 5. Submit button, disabled until rating is picked and comment is non-empty */}
          <div>
            <button
              type="submit"
              disabled={!isValid || submitting}
              className={`w-full py-3 px-4 text-xs font-bold rounded-xl transition-all duration-150 shadow-xs ${
                isValid && !submitting
                  ? 'bg-[#e23744] hover:bg-[#cb202d] text-white cursor-pointer active:scale-[0.99]'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              {submitting ? 'Submitting to backend...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Helper for testing raw curl hacks directly from browser
  const testCurlHack = async (badRating: number, badComment: string, testId: number) => {
    setIsTestingCurl(true);
    setCurlTestResult(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: testId,
          rating: badRating,
          comment: badComment,
        }),
      });
      const data = await res.json();
      setCurlTestResult(`HTTP ${res.status}: ${JSON.stringify(data, null, 2)}`);
    } catch (err: any) {
      setCurlTestResult(`Network error: ${err.message}`);
    } finally {
      setIsTestingCurl(false);
    }
  };

  // Core app content shared across both mobile frame and full view
  const AppContent = (
    <div className="flex flex-col min-h-full justify-between bg-[#f8f8f8] text-[#1c1c1c]">
      {/* Top Zomato Red Bar */}
      <nav className="border-b border-stone-200 bg-white sticky top-0 z-20 px-4 py-3 shadow-2xs">
        <div className="max-w-[560px] mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-black italic text-xl tracking-tight text-[#e23744]">
              zomato
            </span>
            <span className="text-[10px] bg-red-100 text-[#e23744] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
              Lite
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateTo('/restaurant/1')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                screen === 'restaurant'
                  ? 'bg-red-50 text-[#e23744]'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Restaurant
            </button>
            <button
              onClick={() => navigateTo('/review/1')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                screen === 'review'
                  ? 'bg-red-50 text-[#e23744]'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Write Review
            </button>
            <button
              onClick={() => setShowInspector(!showInspector)}
              className="ml-1 text-[11px] px-2 py-1 border border-stone-300 text-stone-600 hover:text-stone-900 rounded-lg bg-white transition-colors"
            >
              {showInspector ? 'Close Lab' : 'PM Lab'}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Single Column Container */}
      <main className="w-full max-w-[560px] mx-auto px-4 py-5 flex-1">
        {screen === 'restaurant' ? <RestaurantScreen /> : <ReviewScreen />}
      </main>

      {/* PM Architectural Concept & Verification Drawer */}
      {showInspector && (
        <section className="border-t border-stone-300 bg-white p-4 text-xs text-stone-800 shadow-inner">
          <div className="max-w-[560px] mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#e23744]">PM Architecture & Verification Lab</h2>
              <span className="text-[10px] text-stone-500 font-mono">Neon Postgres + Express + Gemini</span>
            </div>

            {/* Core Lesson Checklist */}
            <div className="space-y-1.5 text-[11px] text-stone-700 bg-red-50/40 p-3 rounded-xl border border-red-100">
              <p className="font-bold text-[#e23744]">4 Principles Check:</p>
              <p>✓ <strong>Store facts, compute answers:</strong> Rating breakdown counts and averages are computed live via SQL <code className="bg-white px-1 py-0.5 rounded border border-stone-200">AVG()</code> and <code className="bg-white px-1 py-0.5 rounded border border-stone-200">GROUP BY rating</code>.</p>
              <p>✓ <strong>The dining area never cooks:</strong> Frontend has 0 calculations. Receives computed breakdown numbers and prints them directly.</p>
              <p>✓ <strong>Validate twice:</strong> Star picker UI prevents invalid submissions; backend API strictly rejects unauthorized direct requests.</p>
              <p>✓ <strong>Food Item Tagging:</strong> Dishes stored with Veg/Non-Veg flags and rendered with standard FSSAI food icons.</p>
            </div>

            {/* Try Hacking the API (Milestone 7 demonstration) */}
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-2">
              <p className="font-bold text-stone-900 text-[11px]">
                Interactive API Test: Try bypassing UI validation
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  disabled={isTestingCurl}
                  onClick={() => testCurlHack(500, 'hacked rating', 1)}
                  className="px-2 py-1 text-[11px] font-semibold bg-[#e23744] text-white rounded-lg hover:bg-[#cb202d] transition-colors"
                >
                  Test Rating 500
                </button>
                <button
                  disabled={isTestingCurl}
                  onClick={() => testCurlHack(4, '   ', 1)}
                  className="px-2 py-1 text-[11px] font-medium bg-white border border-stone-300 text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
                >
                  Test Whitespace
                </button>
                <button
                  disabled={isTestingCurl}
                  onClick={() => testCurlHack(4, 'Great food', 999)}
                  className="px-2 py-1 text-[11px] font-medium bg-white border border-stone-300 text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
                >
                  Test Restaurant 999
                </button>
              </div>

              {curlTestResult && (
                <div className="mt-2 font-mono text-[11px] p-2 bg-stone-900 text-stone-100 rounded-lg overflow-x-auto whitespace-pre">
                  {curlTestResult}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Subtle Footer */}
      <footer className="border-t border-stone-200 py-4 text-center text-[11px] text-stone-400">
        <p>
          <span className="font-black italic text-[#e23744]">zomato</span> Lite · Built for Product Managers
        </p>
      </footer>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d0e12] text-stone-100 font-sans antialiased flex flex-col justify-between selection:bg-red-500 selection:text-white">
      {/* Studio Top Control Bar */}
      <header className="border-b border-stone-800/80 bg-[#14161d]/90 backdrop-blur-md px-4 py-2.5 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-black italic text-lg tracking-tight text-[#e23744]">zomato</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">Lite</span>
            </div>
            <span className="text-stone-700 hidden sm:inline">|</span>
            <span className="text-stone-400 font-mono text-[11px] hidden sm:inline">
              Route: <span className="text-stone-200 font-semibold">{currentPath}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-stone-800/80 p-0.5 rounded-lg border border-stone-700 flex items-center gap-0.5">
              <button
                onClick={() => setIsMobileFrame(true)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  isMobileFrame
                    ? 'bg-[#e23744] text-white shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                📱 Mobile Frame
              </button>
              <button
                onClick={() => setIsMobileFrame(false)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  !isMobileFrame
                    ? 'bg-[#e23744] text-white shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                🖥️ Full Screen
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-6 w-full">
        {isMobileFrame ? (
          /* Realistic Smartphone Frame Mockup */
          <div className="relative w-full max-w-[412px] my-auto">
            {/* Side Hardware Buttons */}
            <div className="hidden sm:block absolute -left-[14px] top-24 w-1.5 h-7 bg-[#282c37] rounded-l-md border-r border-black/40"></div>
            <div className="hidden sm:block absolute -left-[14px] top-36 w-1.5 h-12 bg-[#282c37] rounded-l-md border-r border-black/40"></div>
            <div className="hidden sm:block absolute -left-[14px] top-52 w-1.5 h-12 bg-[#282c37] rounded-l-md border-r border-black/40"></div>
            <div className="hidden sm:block absolute -right-[14px] top-36 w-1.5 h-16 bg-[#282c37] rounded-r-md border-l border-black/40"></div>

            {/* Smartphone Outer Chassis */}
            <div className="w-full bg-[#1c1f26] rounded-[48px] p-2.5 sm:p-3 border-[3px] border-[#2e3442] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)] ring-1 ring-black">
              {/* Smartphone Inner Screen */}
              <div className="w-full h-[812px] max-h-[86vh] rounded-[38px] overflow-hidden bg-white flex flex-col relative shadow-inner">
                {/* Top Status Bar with Dynamic Island */}
                <MobileStatusBar />

                {/* Scrollable Viewport */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {AppContent}
                </div>

                {/* Bottom Home Indicator */}
                <MobileHomeBar />
              </div>
            </div>
          </div>
        ) : (
          /* Full Viewport Container */
          <div className="w-full max-w-xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden my-4 border border-stone-200">
            {AppContent}
          </div>
        )}
      </div>
    </div>
  );
}
