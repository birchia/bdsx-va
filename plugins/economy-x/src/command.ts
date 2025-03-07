import { CommandPermissionLevel, PlayerCommandSelector } from "bdsx/bds/command";
import { command } from "bdsx/command";
import { int32_t } from "bdsx/nativetype";
import { send } from "./utils/translate";
import { EconomyX } from "..";

command.register("mymoney", send.text("command.mymoney.d"))
.overload((p, o) => {
    const entity = o.getEntity();
    if (entity === null) return;
    const pl = entity.getNetworkIdentifier().getActor();
    if (pl === null) return;

    pl.sendMessage(send.text("command.mymoney.r").replace("%money%", `${EconomyX.currency()}${EconomyX.getMoney(pl)}`));
}, {});

command.register("money", send.text("command.money.d"))
.overload((p, o) => {
    const entity = o.getEntity();
    if (entity === null) return;
    const pl = entity.getNetworkIdentifier().getActor();
    if (pl === null) return;

    for (const tr of p.target.newResults(o)) {
        if (tr.isPlayer()) {
            if (tr === pl) {
                pl.sendMessage(send.text("command.mymoney.r").replace("%money%", `${EconomyX.currency()}${EconomyX.getMoney(pl)}`));
            } else {
                pl.sendMessage(send.text("command.money.r").replace("%player%", tr.getName()).replace("%money%", `${EconomyX.currency()}${EconomyX.getMoney(tr)}`));
            }
         }
    }
}, {
    target: PlayerCommandSelector
});

command.register("transfer", send.text("command.transfer.d"))
.overload((p, o) => {
    const entity = o.getEntity();
    if (entity === null) return;
    const pl = entity.getNetworkIdentifier().getActor();
    if (pl === null) return;

    for (const tr of p.target.newResults(o)) {
        if (tr.isPlayer()) {
            if (tr === pl) {
                pl.sendMessage(send.text("transfer.sameplayer"));
            } else {
                if (p.money < 1) {
                    pl.sendMessage(send.text("number.invalid"));
                    return;
                }
                if (EconomyX.getPlayer(pl) === null) {
                    pl.sendMessage(send.text("transfer.player.xuidnotfound"));
                    return;
                }
                if (EconomyX.getPlayer(tr) === null) {
                    pl.sendMessage(send.text("transfer.target.xuidnotfound"));
                    return;
                }
                if (EconomyX.getMoney(pl)-p.money < 0) {
                    pl.sendMessage(send.text("transfer.player.success").replace("%money%", `${EconomyX.currency()}${EconomyX.getMoney(pl)}`).replace("%player%", tr.getName()));
                    tr.sendMessage(send.text("transfer.target.success").replace("%money%", `${EconomyX.currency()}${EconomyX.getMoney(pl)}`).replace("%player%", pl.getName()));
                    EconomyX.transfer(pl, tr, p.money);
                    return;
                }
                pl.sendMessage(send.text("transfer.player.success").replace("%money%", `${EconomyX.currency()}${p.money}`).replace("%player%", tr.getName()));
                tr.sendMessage(send.text("transfer.target.success").replace("%money%", `${EconomyX.currency()}${p.money}`).replace("%player%", pl.getName()));
                EconomyX.transfer(pl, tr, p.money);
            }
        }
    }
}, {
    target: PlayerCommandSelector,
    money: int32_t
});

command.register("addmoney", send.text("command.addmoney.d"), CommandPermissionLevel.Operator)
.overload((p, o) => {
    const entity = o.getEntity();
    if (entity === null) return;
    const pl = entity.getNetworkIdentifier().getActor();
    if (pl === null) return;

    for (const tr of p.target.newResults(o)) {
        if (tr.isPlayer()) {
            if (p.money < 1) {
                pl.sendMessage(send.text("number.invalid"));
                return;
            }
            if (EconomyX.getPlayer(tr) === null) {
                pl.sendMessage(send.text("xuid.notfound"));
                return;
            }
            EconomyX.addMoney(tr, p.money);
            pl.sendMessage(send.text("command.addmoney.r").replace("%player%", tr.getName()).replace("%money%", `${EconomyX.currency()}${p.money}`));
        }
    }
}, {
    target: PlayerCommandSelector,
    money: int32_t
});

command.register("removemoney", send.text("command.removemoney.d"), CommandPermissionLevel.Operator)
.overload((p, o) => {
    const entity = o.getEntity();
    if (entity === null) return;
    const pl = entity.getNetworkIdentifier().getActor();
    if (pl === null) return;

    for (const tr of p.target.newResults(o)) {
        if (tr.isPlayer()) {
            if (p.money < 1) {
                pl.sendMessage(send.text("number.invalid"));
                return;
            }
            if (EconomyX.getPlayer(tr) === null) {
                pl.sendMessage(send.text("xuid.notfound"));
                return;
            }
            EconomyX.removeMoney(tr, p.money);
            pl.sendMessage(send.text("command.removemoney.r").replace("%player%", tr.getName()).replace("%money%", `${EconomyX.currency()}${p.money}`));
        }
    }
}, {
    target: PlayerCommandSelector,
    money: int32_t
});

command.register("setmoney", send.text("command.setmoney.d"), CommandPermissionLevel.Operator)
.overload((p, o) => {
    const entity = o.getEntity();
    if (entity === null) return;
    const pl = entity.getNetworkIdentifier().getActor();
    if (pl === null) return;

    for (const tr of p.target.newResults(o)) {
        if (tr.isPlayer()) {
            if (p.money < 0) {
                pl.sendMessage(send.text("number.invalid"));
                return;
            }
            if (EconomyX.getPlayer(tr) === null) {
                pl.sendMessage(send.text("xuid.notfound"));
                return;
            }
            EconomyX.setMoney(tr, p.money);
            pl.sendMessage(send.text("command.setmoney.r").replace("%player%", tr.getName()).replace("%money%", `${EconomyX.currency()}${p.money}`));
        }
    }
}, {
    target: PlayerCommandSelector,
    money: int32_t
});