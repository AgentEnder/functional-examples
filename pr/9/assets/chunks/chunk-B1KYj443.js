import{j as e}from"./chunk-CYVrZpTC.js";function o({children:t,label:d="SPEC",revision:i,footer:n,className:l="",style:p,onClick:r}){const a=!!r;return e.jsxs("div",{className:`
        bg-bp-paper-light border border-bp-line-dim/30 rounded-sm
        transition-all duration-200
        hover:border-bp-line-dim/60 hover:-translate-y-0.5
        ${a?"cursor-pointer":""}
        ${l}
      `,style:p,onClick:r,role:a?"button":void 0,tabIndex:a?0:void 0,onKeyDown:a?s=>{(s.key==="Enter"||s.key===" ")&&r?.()}:void 0,children:[e.jsxs("div",{className:"flex items-center justify-between px-4 py-2 border-b border-bp-line-dim/20",children:[e.jsx("span",{className:"bp-annotation text-bp-accent",children:d}),i&&e.jsxs("span",{className:"bp-annotation",children:["REV ",i]})]}),e.jsx("div",{className:"px-4 py-3",children:t}),n&&n.length>0&&e.jsxs(e.Fragment,{children:[e.jsx("hr",{className:"bp-dashed-sep mx-4"}),e.jsx("div",{className:"px-4 py-2 flex gap-4 flex-wrap",children:n.map(({key:s,value:c})=>e.jsxs("div",{className:"bp-annotation",children:[e.jsxs("span",{className:"text-bp-line-dim",children:[s,": "]}),e.jsx("span",{className:"text-bp-line",children:c})]},s))})]})]})}export{o as S};
