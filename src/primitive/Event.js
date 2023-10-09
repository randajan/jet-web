import jet from "@randajan/jet-core";



export default jet.define("Event", Event, {
    extendPrototype:{
        cut(ev, stopPropagation=false) {
            if (!ev) { return; }
            if (ev.preventDefault) { ev.preventDefault(); }
            if (ev.stopPropagation && stopPropagation) { ev.stopPropagation(); }
        },
    }
});