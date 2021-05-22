import {Env} from "./env";
import {UidFactory} from "./uidFactory";

export class LogUtil {
  private readonly id: string;

  constructor() {
    this.id = UidFactory.generateUid(4);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public log(...str: any[]): void {
    const env = Env.get();
    const time = new Date();
    const timeStr =
      env === "dev"
        ? `${this.prefixTime(time.getHours())}:${this.prefixTime(time.getMinutes())}:${this.prefixTime(
            time.getSeconds()
          )}.${time.getMilliseconds().toString().padStart(3, "0")}`
        : "";
    if (env === "dev") {
      console.log(this.colorize(timeStr, 36), `[${this.colorize(this.id, 33)}]`, ...str);
    } else {
      console.log(`[${this.colorize(this.id, 33)}]`, ...str);
    }
  }

  private prefixTime(time: number): string {
    return `${time}`.padStart(2, "0");
  }

  private colorize(str: string, color: number): string {
    const env = Env.get();

    if (env === "dev") {
      return "\x1b[" + color.toString() + "m" + str + "\x1b[0m";
    } else {
      return str;
    }
  }
}
