# Landing Page Design Prompt for Restruct

Create a modern, highly animated landing page for **Restruct** - an intelligent LLM routing platform that automatically selects the optimal AI model for each query.

---

## Brand Identity

### Logo & Name
- **Name:** Restruct
- **Logo:** Located at `assets/logo.png` (orange/warm-toned circular logo)
- **Tagline:** "Intelligent routing for every AI conversation"

### Color Palette
- **Primary Colors:**
  - Neon Gold: `#FFD34F`
  - Neon Pink: `#FF53A5`
  - Neon Blue: `#45E2FF`
- **Background:** Dark theme (charcoal/near-black)
- **Accents:** Use neon colors sparingly for CTAs, highlights, and interactive elements

### Typography
- **Primary Font:** Space Grotesk (weights: 400, 500, 600, 700)
- **Style:** Modern, technical, clean
- **Fallback:** Inter, system-ui, sans-serif

### Design Style
- **Theme:** Dark, futuristic, technical yet approachable
- **Effects:**
  - Glassmorphism (frosted glass effects with subtle transparency)
  - Mesh gradient backgrounds (similar to current signin page)
  - Smooth micro-animations on hover
  - Wave/fluid transitions between sections
  - Particle effects or floating elements
- **Vibe:** Professional but exciting, cutting-edge but trustworthy

---

## What Restruct Does

Restruct is an **intelligent AI routing platform** that solves a critical problem: choosing the right AI model for each task.

### The Problem
- Different AI models excel at different tasks (GPT-5 for reasoning, Claude for writing, Gemini for code)
- Manually switching between models is tedious
- Using premium models for simple tasks wastes money
- Managing multiple API keys and providers is complex

### The Solution
Restruct **automatically routes** each query to the optimal model based on:
1. **Quality** - Best response for the task
2. **Cost** - Most economical option
3. **Latency** - Fastest response time

Users can customize these priorities with visual sliders in the **Routing Lab**.

### Key Features to Highlight

1. **Smart Auto-Routing**
   - Analyzes your prompt in real-time
   - Selects the best model from GPT-5, Claude 3.5 Sonnet, Gemini 1.5 Pro, and more
   - Learns from your preferences

2. **Custom Routing Profiles**
   - Create unlimited profiles for different use cases
   - Adjust quality/cost/latency weights with visual sliders
   - Set hard limits (max cost per call, daily spend caps, token limits)
   - Enable/disable specific providers per profile

3. **Multi-Provider Access**
   - Single API for OpenAI, Anthropic, Google, and more
   - OpenAI SDK-compatible drop-in replacement
   - Streaming support for real-time responses
   - Batch comparisons (test multiple models side-by-side)

4. **Cost Intelligence**
   - Transparent pricing: **5% markup** on token usage
   - Prepaid wallet system - only pay for what you use
   - Real-time cost tracking and analytics
   - Automatic routing to cheaper models when quality difference is negligible

5. **Developer-Friendly**
   - REST API with OpenAI compatibility
   - Persistent API keys
   - Usage logs and analytics
   - Rate limiting per profile
   - Full documentation

6. **Enterprise Features**
   - Usage tracking per profile
   - Team collaboration (future)
   - Custom model preferences
   - Advanced analytics dashboard

---

## Pricing (Highlight This!)

### Simple, Transparent Pricing
**5% markup on token throughput**

**How it works:**
- We charge the provider's token price + 5%
- Example: GPT-5 costs $5/$15 per 1M tokens (input/output)
- You pay: $5.25/$15.75 per 1M tokens
- **That 5% gets you:** intelligent routing, cost savings, analytics, and multi-provider access

### Why This Saves Money
- Auto-routing to cheaper models can **save 50-80%** on costs
- Example: Simple question → routes to GPT-4o-mini ($0.15/M) instead of GPT-5 ($5/M)
- Your 5% markup is easily offset by smart routing
- Set cost limits per profile to prevent overspending

### Prepaid Wallet
- Add funds anytime
- No subscriptions or hidden fees
- Only pay for actual usage
- Real-time balance tracking
- Detailed usage logs

---

## Landing Page Structure

### Section 1: Hero Section (Above the Fold)
**Goal:** Capture attention immediately, explain value prop in 5 seconds

**Content:**
- **Headline:** "Stop Overpaying for AI. Start Routing Smarter."
- **Subheadline:** "Restruct automatically selects the best AI model for every task—saving you money while boosting performance."
- **Visual:**
  - Animated mesh gradient background (like current signin page)
  - Floating model badges (ChatGPT, Claude, Gemini, etc.) that subtly move
  - Central routing visualization showing a prompt → decision tree → optimal model
- **CTA Buttons:**
  - Primary: "Get Started Free" (large, neon gold gradient)
  - Secondary: "View Live Demo" (outline button with neon blue)
- **Social Proof:** "Trusted by developers at [logos if available] or "Join 1000+ developers" or similar

**Animations:**
- Mesh background gently shifts and morphs
- Model badges float/orbit around central element
- Routing visualization animates on page load
- CTA buttons have subtle glow/pulse effect

---

### Section 2: The Problem (Pain Points)
**Goal:** Show we understand user frustrations

**Layout:** 3-column grid with icons

**Content:**
1. **"Wasting Money"**
   - Icon: 💸 or dollar sign
   - Text: "Using GPT-5 for simple tasks? You're spending 30x more than necessary."

2. **"Context Switching Hell"**
   - Icon: 🔄 or arrows
   - Text: "Constantly switching between ChatGPT, Claude, and Gemini wastes time and breaks your flow."

3. **"Guesswork"**
   - Icon: 🎲 or question mark
   - Text: "Which model is best for this task? Should you prioritize speed or quality? It's a constant guessing game."

**Animations:**
- Cards fade in on scroll with stagger
- Icons pulse or rotate gently
- Hover effect: card lifts with shadow

---

### Section 3: The Solution (How Restruct Works)
**Goal:** Explain the magic in simple terms

**Layout:** Large visual diagram with accompanying text

**Visual:**
- Animated flowchart showing:
  ```
  Your Prompt → Restruct Analysis → Model Selection → Response
                      ↓
              Quality Check | Cost Check | Speed Check
                      ↓
          GPT-5 | Claude | Gemini | GPT-4o-mini
  ```

**Content:**
1. **"You Send a Prompt"**
   - "Just like you would to ChatGPT or Claude"

2. **"Restruct Analyzes It"**
   - "Our routing engine evaluates complexity, context, and your preferences in milliseconds"

3. **"Best Model Chosen"**
   - "Automatically selects the optimal model based on your quality/cost/latency settings"

4. **"You Get the Response"**
   - "Faster, cheaper, and just as good—or better"

**Animations:**
- Data flowing through the diagram
- Model badges highlight when "selected"
- Counter showing cost savings in real-time

---

### Section 4: Key Features (Detailed)
**Goal:** Deep dive into capabilities

**Layout:** Alternating left/right sections (feature + visual)

**Features:**

#### 4a. Smart Auto-Routing
- **Visual:** Animated routing decision tree
- **Text:**
  - "Restruct analyzes every prompt and routes to the perfect model"
  - "Complex reasoning? GPT-5. Creative writing? Claude. Code? Gemini."
  - "All automatic. All instant."
- **Stats callout:** "Average 60% cost reduction vs. always using premium models"

#### 4b. Custom Routing Profiles
- **Visual:** Screenshot/mockup of Routing Lab with sliders
- **Text:**
  - "Create unlimited profiles for different workflows"
  - "Personal assistant? Prioritize cost. Critical analysis? Max quality."
  - "Visual sliders for Quality, Cost, and Latency weights"
- **Interactive demo:** Sliders user can drag (updates visual in real-time)

#### 4c. Multi-Provider API
- **Visual:** Code snippet showing OpenAI SDK usage
- **Text:**
  - "Drop-in replacement for OpenAI API"
  - "Access 10+ models with one API key"
  - "No code changes required"
- **Code example:**
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.restruct.ai/v1",
    api_key="your_restruct_key"
)

response = client.chat.completions.create(
    model="auto",  # Let Restruct choose!
    messages=[{"role": "user", "content": "Explain quantum computing"}]
)
```

#### 4d. Real-Time Analytics
- **Visual:** Dashboard screenshot showing charts
- **Text:**
  - "Track every token, every cent"
  - "See which models you use most"
  - "Monitor costs by profile, model, or time period"

#### 4e. Streaming Support
- **Visual:** Animated text appearing token-by-token
- **Text:**
  - "Real-time streaming responses"
  - "Just like ChatGPT's typing effect"
  - "Works with all providers"

#### 4f. Batch Comparisons
- **Visual:** Split-screen showing 3 different model responses
- **Text:**
  - "Test the same prompt across multiple models"
  - "See quality differences side-by-side"
  - "Make informed routing decisions"

**Animations:**
- Sections slide in from left/right as you scroll
- Code blocks have syntax highlighting with typewriter effect
- Charts/graphs animate on scroll

---

### Section 5: Pricing (Detailed Breakdown)
**Goal:** Make pricing crystal clear and show value

**Layout:** Large centered card with pricing calculator

**Content:**
- **Headline:** "Simple Pricing. No Surprises."
- **Subheadline:** "Pay only for what you use, with a tiny 5% markup"

**Pricing Calculator (Interactive!):**
- Input: Number of requests per day
- Input: Average tokens per request (slider)
- Output: Estimated monthly cost with Restruct
- Output: Estimated cost using only GPT-5
- **Savings shown in green:** "Save $XXX/month with smart routing"

**Comparison Table:**
| Feature | Using Providers Directly | With Restruct |
|---------|-------------------------|---------------|
| Cost | $200/month (GPT-5 only) | $85/month (smart routing) + 5% markup = **$89/month** |
| Setup | Manage 3+ API keys | One API key |
| Optimization | Manual model switching | Automatic routing |
| Analytics | None | Full dashboard |
| **Total Value** | ❌ Expensive, manual | ✅ Cheaper, automated |

**Animations:**
- Calculator numbers count up smoothly
- Savings amount pulses with green glow
- Comparison table rows fade in sequentially

---

### Section 6: Use Cases (Who It's For)
**Goal:** Help visitors see themselves using Restruct

**Layout:** 3-4 cards with personas

**Cards:**

1. **"Indie Developers"**
   - Icon: 👨‍💻
   - "Build AI features without breaking the bank"
   - "Auto-route to cheap models for dev/testing, premium for production"

2. **"Startups"**
   - Icon: 🚀
   - "Scale AI costs intelligently as you grow"
   - "Detailed analytics for investor reports"

3. **"AI Power Users"**
   - Icon: ⚡
   - "Access all top models in one place"
   - "Compare responses, optimize workflows"

4. **"Enterprise Teams"** (if applicable)
   - Icon: 🏢
   - "Centralized billing and usage tracking"
   - "Custom routing policies per team/project"

**Animations:**
- Cards have parallax effect on scroll
- Hover: card expands slightly with glow

---

### Section 7: Social Proof / Testimonials
**Goal:** Build trust

**Content:**
- If you have testimonials, show them here
- If not, show:
  - "Built by developers, for developers"
  - Open source commitment or API uptime stats
  - "99.9% API uptime" or similar
  - GitHub stars (if public repo)

**Visual:**
- Scrolling testimonial carousel
- Avatar images with name/title

---

### Section 8: FAQ
**Goal:** Answer common objections

**Layout:** Accordion/expandable sections

**Questions:**
1. "How does auto-routing work?"
2. "Can I still choose a specific model?"
3. "What if a model fails?"
4. "Do you store my API keys?"
5. "Is my data secure?"
6. "Can I cancel anytime?"
7. "How do I get started?"

**Animations:**
- Smooth expand/collapse with easing
- Icons rotate when expanded

---

### Section 9: Final CTA (Call to Action)
**Goal:** Convert visitors

**Content:**
- **Headline:** "Ready to Route Smarter?"
- **Subheadline:** "Join developers who are saving 60% on AI costs"
- **CTA Button:** "Start Free Today" (huge, glowing neon gold button)
- **Secondary:** "Schedule a Demo"
- **Trust signals:** "No credit card required" | "5 minute setup" | "Cancel anytime"

**Visual:**
- Gradient background with animated mesh
- Floating particles or light rays
- Model logos orbiting the CTA

**Animations:**
- CTA button has constant subtle glow pulse
- Particles drift upward
- Background gradient shifts slowly

---

### Footer
**Content:**
- Logo
- Quick links: Features, Pricing, Docs, API, Blog
- Social links
- Legal: Privacy, Terms
- Copyright

**Style:**
- Dark with subtle grid pattern
- Links have neon underline on hover

---

## Animation Guidelines

### Micro-Interactions
- **Buttons:** Scale + glow on hover, ripple on click
- **Links:** Neon underline slides in from left
- **Cards:** Lift with shadow on hover, rotate slightly on mouse move (parallax)
- **Icons:** Gentle bounce or rotate on hover

### Scroll Animations (Use Intersection Observer or Framer Motion)
- **Fade in + slide up:** For section headings and paragraphs
- **Stagger:** For grids of cards (0.1s delay between each)
- **Number counters:** Count up when visible (e.g., "60% savings")
- **Progress bars:** Fill when scrolled into view
- **Charts:** Animate drawing lines/bars

### Background Effects
- **Mesh gradient:** Slow morphing between color stops
- **Particles:** Floating orbs drifting upward
- **Parallax:** Background moves slower than foreground on scroll
- **Mouse tracking:** Subtle gradient shift following cursor on hero

### Performance
- Use `will-change` CSS for animated elements
- Lazy load images below the fold
- Optimize SVGs and use CSS animations over JavaScript when possible
- Ensure 60fps on animations

---

## Technical Implementation Suggestions

### Framework
- **React** (since the current app uses React)
- **Framer Motion** for animations (already in project dependencies)
- **TailwindCSS** for styling (already in project)
- **Chart.js** for pricing calculator and stats

### Structure
```
/landing
  /components
    Hero.jsx
    ProblemSection.jsx
    SolutionSection.jsx
    FeaturesSection.jsx
    PricingSection.jsx
    UseCases.jsx
    FAQ.jsx
    FinalCTA.jsx
  /animations
    MeshBackground.jsx
    FloatingModels.jsx
    RoutingDiagram.jsx
  landing.html
  landing.css
```

### Responsive Design
- Mobile-first approach
- Stack columns on mobile
- Simplify animations on mobile (reduce motion if `prefers-reduced-motion`)
- Touch-friendly button sizes (min 48px)

---

## Assets Needed

### Model Logos (Already have these)
- ChatGPT logo (`assets/chatgpt-logo.png`)
- Claude logo (`assets/claude-logo.png`)
- Gemini logo (`assets/gemini-logo.png`)
- Qwen logo (`assets/qwen-logo.png`)
- Mistral logo (`assets/mistral-logo.png`)
- And others in `assets/` folder

### Icons
- Use **Heroicons** or **Lucide Icons** (clean, modern)
- Or custom SVG icons matching neon theme

### Images/Screenshots
- Routing Lab screenshot (if available)
- Dashboard screenshot (if available)
- Code editor with Restruct API usage

---

## Tone & Copy Guidelines

### Voice
- **Confident but not arrogant:** "Save 60% on AI costs" not "We're the best"
- **Technical but accessible:** Use terms like "routing" and "API" but explain them
- **Value-focused:** Lead with benefits, not features
- **Conversational:** "You send a prompt" not "Users submit queries"

### Words to Use
- Smart, intelligent, optimal, efficient, transparent, simple, powerful
- Save, boost, automate, control, track, analyze
- Seamless, instant, real-time, automatic

### Words to Avoid
- Revolutionary, disruptive, game-changer (overused)
- Complicated technical jargon without explanation
- Negative language about competitors

---

## Examples of Great Landing Pages for Inspiration

1. **Linear** (linear.app) - Dark theme, smooth animations, clean design
2. **Vercel** (vercel.com) - Gradient meshes, technical but approachable
3. **Stripe** (stripe.com) - Clear value prop, animated diagrams
4. **Resend** (resend.com) - Developer-focused, code examples
5. **Cal.com** (cal.com) - Simple, effective CTAs

---

## Success Criteria

A successful landing page should:
1. ✅ Explain what Restruct does in 5 seconds (hero section)
2. ✅ Show clear pricing (5% markup, prepaid)
3. ✅ Demonstrate cost savings (60% average)
4. ✅ Have at least 3 strong CTAs (hero, mid-page, footer)
5. ✅ Be fully responsive (mobile/tablet/desktop)
6. ✅ Load in under 3 seconds
7. ✅ Have smooth 60fps animations
8. ✅ Match Restruct's dark/neon aesthetic perfectly

---

## Final Notes

- **Make it visual:** Show, don't just tell. Use diagrams, animations, and interactive elements.
- **Build trust:** Emphasize transparency, security, and developer-friendly features.
- **Clear CTAs:** Every section should guide toward signing up or learning more.
- **Mobile matters:** 50%+ of traffic will be mobile—test thoroughly.
- **Performance:** Beautiful animations mean nothing if the page loads slowly.

Good luck building an amazing landing page! 🚀
