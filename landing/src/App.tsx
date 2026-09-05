import { Nav } from './components/Nav'
import { FilmStage } from './components/FilmStage'
import { StatusStrip } from './components/StatusStrip'
import { Problem, Solution, Personas, Showcase, Platforms, Finale } from './components/sections'
import { Pricing } from './components/Pricing'
import { Footer } from './components/Footer'
import { Grain } from './components/Grain'

/* One page. The scroll-scrubbed film act opens (with a static fork for
   engines that can't decode it, and for reduced motion — see FilmStage),
   then hands off through a dark→light band into the light editorial body. */
export default function App() {
  return (
    <>
      <Nav />
      <main>
        <FilmStage />
        <StatusStrip />
        <Problem />
        <Solution />
        <Personas />
        <Showcase />
        <Platforms />
        <Pricing />
        <Finale />
      </main>
      <Footer />
      <Grain />
    </>
  )
}
