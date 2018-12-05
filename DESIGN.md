In this document, I'll go over various facets of the project and my decisions in implementing them. 

The Grid

The first thing I started implementing was the basic code to render the grid on a canvas element, mostly located in the drawGrid method. I made the decision early to detect the user's screen boundaries, convert those into coordinates on the grid, and use those measurements to only have to render the pixels that would be visible on the screen. This prevents a lot of needless slowdown, and lets the program support a very large grid size without slowing down. Initially, I used a system of modes (Move and Draw) to determine whether mouse events should be interpreted as movement or draw events. That was needlessly confusing, so currently I can distinguish between an in-place "click" and a "drag" to determine whether to move the grid or to update a pixel.
One of the most challenging aspects of rendering grid was the zooming feature. After an unsuccesful attempt of simply changing the grid's scaling constant depending on scroll motion, I realized that I would need to be able to specifiy a point on the grid to fix in place during the zoom; namely, the point under the mouse cursor. The zoomIntoPoint method accomplishes this along with a helper function toGridCoords, which can translate "Screen Coordinate" to "Grid Coordinates", a necesary distinction for some operations. 
At the end of the project, I implemented support for mobile devices. This was another challenge, especially because mobile navigation would require a new kind of navigation: pinch zoom. Translational movement was very similar to the mouse-only case, but to implememnt pinch zoom I needed to support multi-touch, as well as figure out how pinch zoom actually works (it's more complicated than I'd ever though about before). Essentially, I look at how much each touch moved "away from each other" relative to how far apart they started, and apply the effect of each motion in succession; this way, the grid points underneath both fingers will be preserved during the zoom, allowing the zoom to feel natural and intuitive. 




The Server