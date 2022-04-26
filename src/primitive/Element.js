import jet from "@randajan/jet-core";

const enumerable = true;
const DRAG = {
    evmap:{ mousedown:"start", touchstart:"start", mouseup:"stop", touchend:"stop", mousemove:"move", touchmove:"move" },
    evlist:["mousemove", "touchmove", "mouseup", "touchend"],
    bounds:[ 
        "state", "left", "right", "top", "bottom", "width", "height", "parent",
        "pickX", "pickY", "startX", "startY", "lastX", "lastY"
    ]
}


export default jet.define("Element", Element, {
    create:(x, ...args)=>document.createElement(String.jet.to(x) || "div", ...args),
    to:x=>x.outerHTML,
    extendConstructor:{
        find:(query, all=false)=>all ? document.querySelectorAll(query) : document.querySelector(query),
    },
    extendPrototype:{
        parent:ele=>ele ? (ele.parentElement || ele.parentNode) : undefined,
        scroll:ele=>{
            const s = "scroll", c = "client";
            let w = window, h = document.documentElement, b = document.body;
            const real = ele !== b;
            if (real) { w = h = b = ele; }
            return jet.map({top:"Y", left:"X"}, (v, k)=>{
                let d = String.jet.capitalize(k);
                let scroll = Number.jet.tap(w["page"+v+"Offset"], h[s+d], b[s+d]);
                let client = Number.jet.tap(h[c+d], b[c+d]);
                return scroll-client;
            });
        },
        bound:(ele, offset, client)=>{
            if (!Element.jet.parent(ele)) { return {}}
            const t = client ? "client" : offset ? "offset" : null;
            const r = t ? null : ele.getBoundingClientRect();
            const width = r ? r.width : ele[t+"Width"];
            const height = r ? r.height : ele[t+"Height"];
            const left = r ? r.left : ele[t+"Left"] - ele.scrollLeft;
            const top = r ? r.top : ele[t+"Top"] - ele.scrollTop;
            const right = r ? r.right : left + width;
            const bottom = r ? r.bottom : top + height;
            return { width, height, left, top, right, bottom }
        },
        listen:(ele, type, handler, opt, append=true)=>{
            ele = Element.jet.is(ele, false) ? ele : document;
            type = String.jet.to(type) || "click";
            handler = jet.isRunnable(handler) ? handler : Event.jet.cut;
            ele[(append ? "add" : "remove")+"EventListener"](type, handler, opt);
            return _=>Element.jet.listen(ele, type, handler, opt, !append);
        },
        drift(ele, onDrag, opt={}) {

            opt.up = Number.jet.tap(opt.up, 1);
            opt.left = Number.jet.tap(opt.left, 1);
            opt.right = Number.jet.tap(opt.right, 1);
            opt.down = Number.jet.tap(opt.down, 1);

            let { autoPick, appendState } = opt;
    
            let _b, parent = Element.jet.parent(ele);
            const bound = Object.defineProperties({}, {
                target:{enumerable, value:ele},
                time:{enumerable, get:_=>(_b.stopTime || new Date())-_b.startTime},
                x:{enumerable, get:_=>_b.x, set:v=>_b.x=Number.jet.to(v)},
                y:{enumerable, get:_=>_b.y, set:v=>_b.y=Number.jet.to(v)},
                relX:{enumerable, get:_=>_b.x/_b.parent.width, set:v=>_b.x=Number.jet.to(v)*_b.parent.width},
                relY:{enumerable, get:_=>_b.y/_b.parent.height, set:v=>_b.y=Number.jet.to(v)*_b.parent.height},
                distX:{enumerable, get:_=>_b.x-_b.startX, set:v=>_b.x=_b.startX+v},
                distY:{enumerable, get:_=>_b.y-_b.startY, set:v=>_b.y=_b.startY+v},
                dist:{enumerable, get:_=>Math.sqrt(Math.pow(bound.distX, 2)+Math.pow(bound.distY, 2))},
                dirX:{enumerable, get:_=>bound.distX > 0 ? "right" : "left" },
                dirY:{enumerable, get:_=>bound.distY > 0 ? "down" : "up"},
                dir:{enumerable, get:_=>Math.abs(bound.distX) > Math.abs(bound.distY) ? bound.dirX : bound.dirY}
            }); 
    
            DRAG.bounds.map(k=>Object.defineProperty(bound, k, {enumerable, get:_=>_b[k]}));
    
            function move(ev) {
                if (!parent) { return; }
                const state = ev ? DRAG.evmap[ev.type] : "init";
                const init = (state === "start" || state === "init");
    
                if (init) { 
                    _b = Element.jet.bound(ele);
                    _b.parent = Element.jet.bound(parent);
                }

                const ct = ev?.changedTouches;
                const pos = (ct ? ct[0] : ev) || { clientX:_b.left+_b.width/2, clientY:_b.top+_b.height/2 };
    
                if (init) {
                    _b.startTime = new Date();
                    _b.pickX = autoPick ? 0 : (_b.width/2 - (pos.clientX-_b.left)) || 0;
                    _b.pickY = autoPick ? 0 : (_b.height/2 - (pos.clientY-_b.top)) || 0;
                }
    
                _b.state = state;
                _b.x = (pos.clientX - _b.parent.left + _b.pickX) || 0;
                _b.y = (pos.clientY - _b.parent.top + _b.pickY) || 0;
    
                if (init) { _b.prevX = _b.startX = _b.x; _b.prevY = _b.startY = _b.y; }
                
                if (state === "stop") { _b.stopTime = new Date(); }
                if (state === "stop" || state === "start") {
                    DRAG.evlist.map(ev=>[
                        Element.jet.listen(document, ev, move, null, state === "start"),
                        DRAG.evmap[ev] === "move" ? Element.jet.listen(ele, ev, null, null, state === "start") : null
                    ]);
                } 
                if (state === "stop" || state === "move") {
                    bound.distX = bound.distX*opt[bound.dirX];
                    bound.distY = bound.distY*opt[bound.dirY];
                }
                if (appendState) {
                    if (state === "move") { ele.setAttribute("data-drift", [bound.dirY, bound.dirX].join(" ")); }
                    else { ele.removeAttribute("data-drift"); }
                }
                
                onDrag(ev, bound);

                _b.prevX = _b.x; _b.prevY = _b.y;
            };
    
            const cleanUp = ["mousedown", "touchstart"].map(k=>[
                Element.jet.listen(ele, k, move, {pasive:false}),
                autoPick ? Element.jet.listen(parent, k, move, {pasive:false}) : null,
            ]);

            move();
            return _=>jet.run(cleanUp);
        },
        drag(ele, onShift, opt={}) {
            let { initX, initY, absolute, autoReset } = opt;
    
            function set(x, y) {
                ele.style.left = absolute ? x+"px" : (x*100)+"%";
                ele.style.top = absolute ? y+"px" : (y*100)+"%";
            }
            set(Number.jet.to(initX), Number.jet.to(initY));
            
            return Element.jet.drift(ele, (ev, bound)=>{
                if (onShift) { onShift(ev, bound); }
                if (bound.state === "move") { Event.jet.cut(ev); }
                if (bound.state === "stop" && autoReset) { set(initX, initY); }
                else if (bound.state !== "init") { set(absolute ? bound.x : bound.relX, absolute ? bound.y : bound.relY); }
            }, opt);
        },
        swipe(ele, onSwipe, opt={}) {

            opt.autoReset = true;
            opt.autoPick = false;
            opt.up = Number.jet.tap(opt.up);
            opt.left = Number.jet.tap(opt.left);
            opt.right = Number.jet.tap(opt.right);
            opt.down = Number.jet.tap(opt.down);
            opt.minDist = Number.jet.tap(opt.minDist, 50);
            opt.maxTime = Number.jet.tap(opt.maxTime, 500);

            let { minDist, maxTime } = opt;

            return Element.jet.drag(ele, (ev, bound)=>{
                const { state, time, dist } = bound;
                if (onSwipe && state === "stop" && time < maxTime && dist > minDist) { onSwipe(ev, bound); }
            }, opt);
        }
    }
});