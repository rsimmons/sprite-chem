import { Runner } from "../../extlib/runner";

const spriteWorldRunner: Runner = {
  create: (context) => {
    context.container.innerHTML = `<div style="width: 100%; height: 100%>spriteWorldRunner</div>`;

    return {
    };
  },
};

export default spriteWorldRunner;
