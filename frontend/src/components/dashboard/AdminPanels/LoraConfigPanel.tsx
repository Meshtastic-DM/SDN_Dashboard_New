import { useMemo, useState } from "react";
import { Loader2, Radio, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useGetLoraConfig, useSetLoraConfig } from "@/hooks/useAdminApi";
import { NodeDisplayData } from "@/types/nodes";

interface Props {
  selectedNode: NodeDisplayData;
}

type BooleanMode = "keep" | "true" | "false";

type FormState = {
  region: string;
  modemPreset: string;
  txPower: string;
  channelNum: string;
  bandwidth: string;
  spreadFactor: string;
  codingRate: string;
  frequencyOffset: string;
  overrideFrequency: string;
  txEnabled: BooleanMode;
  ignoreMqtt: BooleanMode;
};

const EMPTY_FORM: FormState = {
  region: "",
  modemPreset: "",
  txPower: "",
  channelNum: "",
  bandwidth: "",
  spreadFactor: "",
  codingRate: "",
  frequencyOffset: "",
  overrideFrequency: "",
  txEnabled: "keep",
  ignoreMqtt: "keep",
};

const NUMERIC_FIELDS: Array<{ key: keyof FormState; label: string; step?: string }> = [
  { key: "region", label: "Region" },
  { key: "modemPreset", label: "Modem Preset" },
  { key: "txPower", label: "TX Power" },
  { key: "channelNum", label: "Channel Number" },
  { key: "bandwidth", label: "Bandwidth" },
  { key: "spreadFactor", label: "Spread Factor" },
  { key: "codingRate", label: "Coding Rate" },
  { key: "frequencyOffset", label: "Frequency Offset", step: "any" },
  { key: "overrideFrequency", label: "Override Frequency", step: "any" },
];

export default function LoraConfigPanel({ selectedNode }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [wantAck, setWantAck] = useState(true);
  const [verifyAfterSet, setVerifyAfterSet] = useState(true);
  const [lastLoadedConfig, setLastLoadedConfig] = useState<Record<string, unknown> | null>(null);

  const getLoraConfigMutation = useGetLoraConfig();
  const setLoraConfigMutation = useSetLoraConfig();

  const hasAnyValue = useMemo(
    () =>
      NUMERIC_FIELDS.some(({ key }) => String(form[key]).trim() !== "") ||
      form.txEnabled !== "keep" ||
      form.ignoreMqtt !== "keep",
    [form]
  );

  const updateField = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const loadCurrentConfig = () => {
    getLoraConfigMutation.mutate(
      { targetNode: selectedNode.id, wantAck },
      {
        onSuccess: (response) => {
          const config = (response.details?.config ?? {}) as Record<string, unknown>;
          setLastLoadedConfig(config);
          setForm({
            region: toInputValue(config.region),
            modemPreset: toInputValue(config.modem_preset),
            txPower: toInputValue(config.tx_power),
            channelNum: toInputValue(config.channel_num),
            bandwidth: toInputValue(config.bandwidth),
            spreadFactor: toInputValue(config.spread_factor),
            codingRate: toInputValue(config.coding_rate),
            frequencyOffset: toInputValue(config.frequency_offset),
            overrideFrequency: toInputValue(config.override_frequency),
            txEnabled: toBooleanMode(config.tx_enabled),
            ignoreMqtt: toBooleanMode(config.ignore_mqtt),
          });
        },
      }
    );
  };

  const applyConfig = () => {
    const payload = {
      region: parseOptionalInt(form.region),
      modemPreset: parseOptionalInt(form.modemPreset),
      txPower: parseOptionalInt(form.txPower),
      channelNum: parseOptionalInt(form.channelNum),
      bandwidth: parseOptionalInt(form.bandwidth),
      spreadFactor: parseOptionalInt(form.spreadFactor),
      codingRate: parseOptionalInt(form.codingRate),
      frequencyOffset: parseOptionalFloat(form.frequencyOffset),
      overrideFrequency: parseOptionalFloat(form.overrideFrequency),
      txEnabled: parseOptionalBoolean(form.txEnabled),
      ignoreMqtt: parseOptionalBoolean(form.ignoreMqtt),
    };

    setLoraConfigMutation.mutate({
      targetNode: selectedNode.id,
      loraConfig: payload,
      wantAck,
      verifyAfterSet,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded border border-border bg-muted/30 p-3 text-xs font-mono space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">Current LoRa Config</p>
          <Button
            onClick={loadCurrentConfig}
            disabled={getLoraConfigMutation.isPending}
            size="sm"
            variant="outline"
            className="h-7 text-[11px] font-mono"
          >
            {getLoraConfigMutation.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Load Current
          </Button>
        </div>

        {lastLoadedConfig ? (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[10px] text-card-foreground">
            {JSON.stringify(lastLoadedConfig, null, 2)}
          </pre>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Load the device's current LoRa config first, then edit the fields below.
          </p>
        )}

        {getLoraConfigMutation.isError && (
          <p className="text-[11px] text-node-offline">
            {getLoraConfigMutation.error instanceof Error
              ? getLoraConfigMutation.error.message
              : "Failed to load LoRa config."}
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {NUMERIC_FIELDS.map(({ key, label, step }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key} className="text-xs font-mono text-muted-foreground">
              {label}
            </Label>
            <Input
              id={key}
              type="number"
              step={step}
              value={form[key]}
              onChange={(e) => updateField(key, e.target.value)}
              placeholder="Leave blank to keep current"
              className="h-8 text-xs font-mono"
            />
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-mono text-muted-foreground">TX Enabled</Label>
          <Select value={form.txEnabled} onValueChange={(value) => updateField("txEnabled", value)}>
            <SelectTrigger className="h-8 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep">Keep current</SelectItem>
              <SelectItem value="true">Enabled</SelectItem>
              <SelectItem value="false">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-mono text-muted-foreground">Ignore MQTT</Label>
          <Select value={form.ignoreMqtt} onValueChange={(value) => updateField("ignoreMqtt", value)}>
            <SelectTrigger className="h-8 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep">Keep current</SelectItem>
              <SelectItem value="true">Enabled</SelectItem>
              <SelectItem value="false">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex items-center gap-2 cursor-pointer text-xs">
          <Checkbox checked={wantAck} onCheckedChange={(checked) => setWantAck(checked === true)} />
          <span className="text-muted-foreground">Want ACK</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-xs">
          <Checkbox
            checked={verifyAfterSet}
            onCheckedChange={(checked) => setVerifyAfterSet(checked === true)}
          />
          <span className="text-muted-foreground">Verify after set</span>
        </label>
      </div>

      <Button
        onClick={applyConfig}
        disabled={setLoraConfigMutation.isPending || !hasAnyValue}
        size="sm"
        className="w-full h-8 text-xs font-mono"
        variant="outline"
      >
        {setLoraConfigMutation.isPending ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Radio className="mr-1 h-3 w-3" />
        )}
        Apply LoRa Config
      </Button>

      {setLoraConfigMutation.data && (
        <div className="rounded border border-border bg-muted/30 p-3 text-xs font-mono space-y-2">
          <p className="text-muted-foreground">Update Result</p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[10px] text-card-foreground">
            {JSON.stringify(setLoraConfigMutation.data.details, null, 2)}
          </pre>
        </div>
      )}

      {setLoraConfigMutation.isError && (
        <div className="rounded border border-node-offline/30 bg-node-offline/10 p-3 text-xs font-mono text-node-offline">
          {setLoraConfigMutation.error instanceof Error
            ? setLoraConfigMutation.error.message
            : "Failed to apply LoRa config."}
        </div>
      )}
    </div>
  );
}

function toInputValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function toBooleanMode(value: unknown): BooleanMode {
  if (value === true) return "true";
  if (value === false) return "false";
  return "keep";
}

function parseOptionalInt(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseOptionalFloat(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseOptionalBoolean(value: BooleanMode) {
  if (value === "keep") return undefined;
  return value === "true";
}
