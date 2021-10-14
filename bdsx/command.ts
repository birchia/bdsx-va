
import { Command, CommandCheatFlag, CommandContext, CommandOutput, CommandParameterData, CommandParameterDataType, CommandPermissionLevel, CommandRegistry, CommandUsageFlag, CommandVisibilityFlag, MCRESULT, MinecraftCommands } from './bds/command';
import { CommandOrigin } from './bds/commandorigin';
import { procHacker } from './bds/proc';
import { serverInstance } from './bds/server';
import { events } from './event';
import { bedrockServer } from './launcher';
import { makefunc } from './makefunc';
import { nativeClass, nativeField } from './nativeclass';
import { bool_t, CxxString, int32_t, NativeType, Type, void_t } from './nativetype';
import { SharedPtr } from './sharedpointer';
import { _tickCallback } from './util';


let executeCommandOriginal:(cmd:MinecraftCommands, res:MCRESULT, ctxptr:SharedPtr<CommandContext>, b:bool_t)=>MCRESULT;
function executeCommand(cmd:MinecraftCommands, res:MCRESULT, ctxptr:SharedPtr<CommandContext>, b:bool_t):MCRESULT {
    try {
        const ctx = ctxptr.p!;
        const name = ctx.origin.getName();
        const resv = events.command.fire(ctxptr.p!.command, name, ctx);
        switch (typeof resv) {
        case 'number':
            res.result = resv;
            _tickCallback();
            return res;
        default:
            _tickCallback();
            return executeCommandOriginal(cmd, res, ctxptr, b);
        }
    } catch (err) {
        events.errorFire(err);
        res.result = -1;
        return res;
    }
}

MinecraftCommands.prototype.executeCommand = function(ctx, b) {
    const res = new MCRESULT(true);
    return executeCommand(this, res, ctx, b);
};

@nativeClass()
export class CustomCommand extends Command {
    @nativeField(Command.VFTable)
    self_vftable:Command.VFTable;

    [NativeType.ctor]():void {
        this.self_vftable.destructor = customCommandDtor;
        this.self_vftable.execute = null;
        this.vftable = this.self_vftable;
    }

    execute(origin:CommandOrigin, output:CommandOutput):void {
        // empty
    }
}

export class CustomCommandFactory {

    constructor(
        public readonly registry:CommandRegistry,
        public readonly name:string) {
    }
    overload<PARAMS extends Record<string, Type<any>|CommandEnum|[Type<any>|CommandEnum, boolean]>>(
        callback:(params:{
            [key in keyof PARAMS]:PARAMS[key] extends [Type<infer F>, infer V] ?
                (V extends true ? F|undefined : F) :
                (PARAMS[key] extends {prototype:infer F} ? F : PARAMS[key] extends Type<infer F> ? F :
                PARAMS[key] extends CommandEnum ? number : never)
            }, origin:CommandOrigin, output:CommandOutput)=>void,
        parameters:PARAMS):this {

        const paramNames:[keyof CustomCommandImpl, (keyof CustomCommandImpl)?][] = [];
        class CustomCommandImpl extends CustomCommand {
            [NativeType.ctor]():void {
                this.self_vftable.execute = customCommandExecute;
            }
            execute(origin:CommandOrigin, output:CommandOutput):void {
                try {
                    const nobj:Record<keyof CustomCommandImpl, any> = {} as any;
                    for (const [name, optkey] of paramNames) {
                        if (optkey == null || this[optkey]) {
                            if ((fields[name.toString()] as any)[enumIdSymbol]) {
                                const enumObj = (fields[name.toString()] as CommandEnum);
                                const enumValue = (this[name] as any as string).toLowerCase();
                                const enumValues = enumObj[enumValuesSymbol] as any as string[];
                                nobj[name] = enumValues.indexOf(enumValue) + 1;
                            } else {
                                nobj[name] = this[name];
                            }
                        }
                    }
                    callback(nobj as any, origin, output);
                } catch (err) {
                    events.errorFire(err);
                }
            }
        }

        (parameters as any).__proto__ = null;
        const fields:Record<string, Type<any>|CommandEnum> = Object.create(null);
        for (const name in parameters) {
            let optional = false;
            let type:Type<any>|CommandEnum|[Type<any>|CommandEnum,boolean] = parameters[name];
            if (type instanceof Array) {
                optional = type[1];
                type = type[0];
            }
            if (name in fields) throw Error(`${name}: field name duplicated`);
            fields[name] = type;
            if (optional) {
                const optkey = name+'__set';
                if (optkey in fields) throw Error(`${optkey}: field name duplicated`);
                fields[optkey] = bool_t;
                paramNames.push([name as keyof CustomCommandImpl, optkey as keyof CustomCommandImpl]);
            } else {
                paramNames.push([name as keyof CustomCommandImpl]);
            }
        }

        const params:CommandParameterData[] = [];
        CustomCommandImpl.define(fields);
        for (const [name, optkey] of paramNames) {
            if ((fields[name.toString()] as any)[enumIdSymbol]) {
                if (optkey != null) params.push(CustomCommandImpl.optional(name, optkey as any, (fields[name.toString()] as any)[enumNameSymbol], CommandParameterDataType.ENUM, name.toString(), (fields[name.toString()] as any)[enumIdSymbol]));
                else params.push(CustomCommandImpl.mandatory(name, null, (fields[name.toString()] as any)[enumNameSymbol], CommandParameterDataType.ENUM, name.toString(), (fields[name.toString()] as any)[enumIdSymbol]));
            } else {
                if (optkey != null) params.push(CustomCommandImpl.optional(name, optkey as any));
                else params.push(CustomCommandImpl.mandatory(name, null));
            }
        }

        const customCommandExecute = makefunc.np(function(this:CustomCommandImpl, origin:CommandOrigin, output:CommandOutput){
            this.execute(origin, output);
        }, void_t, {this:CustomCommandImpl}, CommandOrigin, CommandOutput);

        this.registry.registerOverload(this.name, CustomCommandImpl, params);
        return this;
    }

    alias(alias:string):this {
        this.registry.registerAlias(this.name, alias);
        return this;
    }
}

const enumNameSymbol = Symbol("enumName");
const enumIdSymbol = Symbol("enumId");
const enumValuesSymbol = Symbol("enumValues");
type CommandEnum = Record<typeof enumNameSymbol|typeof enumIdSymbol|typeof enumValuesSymbol|string, number>;
export namespace command {

    export function register(name:string,
        description:string,
        perm:CommandPermissionLevel = CommandPermissionLevel.Normal,
        flags1:CommandCheatFlag|CommandVisibilityFlag = CommandCheatFlag.NotCheat,
        flags2:CommandUsageFlag|CommandVisibilityFlag = CommandUsageFlag._Unknown):CustomCommandFactory {
        const registry = serverInstance.minecraft.getCommands().getRegistry();
        const cmd = registry.findCommand(name);
        if (cmd !== null) throw Error(`${name}: command already registered`);
        registry.registerCommand(name, description, perm, flags1, flags2);
        return new CustomCommandFactory(registry, name);
    }

    export function addEnum<T extends string[]>(name:string, ...args: T): Record<typeof args[number]|typeof enumNameSymbol|typeof enumIdSymbol|typeof enumValuesSymbol, number> {
        const registry = serverInstance.minecraft.getCommands().getRegistry();
        const values = new Array<string>();
        for (const value of args) {
            const _value = value.toLowerCase();
            if (values.includes(_value)) throw Error(`${value}: enum value duplicated`);
            /*
                Allowed special characters:
                - (
                - )
                - -
                - .
                - ?
                - _
                and the ones whose ascii code is bigger than 127, like §, ©, etc.
            */
            if (/[ -'*-,/:->@[-^`{-~]/.test(_value)) throw Error(`${value}: enum value contains invalid characters`);
            values.push(_value.toLowerCase());
        }
        const enumId = registry.addEnumValues(name, values);
        const CustomEnum = CxxString.extends();
        Object.defineProperty(CustomEnum, enumNameSymbol, {value:name});
        Object.defineProperty(CustomEnum, enumIdSymbol, {value:enumId});
        Object.defineProperty(CustomEnum, enumValuesSymbol, {value:values});
        Object.defineProperty(CustomEnum, "name", {value:name});
        for (const [i, key] of args.entries()) {
            Object.defineProperty(CustomEnum, key, {value:i + 1});
        }
        return CustomEnum as any;
    }
}

const customCommandDtor = makefunc.np(function(){
    this[NativeType.dtor]();
}, void_t, {this:CustomCommand}, int32_t);


bedrockServer.withLoading().then(()=>{
    executeCommandOriginal = procHacker.hooking('MinecraftCommands::executeCommand', MCRESULT, null,
        MinecraftCommands, MCRESULT, SharedPtr.make(CommandContext), bool_t)(executeCommand);
});
