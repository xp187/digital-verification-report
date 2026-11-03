# t_8b1lane_HIZ_SEL0 Verification Plan (HIZ_SEL, 0x22[0])

## 1. Goal

Verify the "CS by POL" behavior of `HIZ_SEL`: when set to 1, the ANCTL block
gates `LD_F` low inside each polarity-switch window (`POL_SW`), which switches
the STB output multiplexer from the FAKE version back to the real STB for that
window (charge-sharing phase around polarity flips). Register facts: 0x22[0],
default 0, N_RST_NLOCK domain, protected by `LSI_PRTECT`
(`R_HIZ_SEL = LSI_PRTECT ? R_REG34_F[0] : 1'b0`, LC_CPUWR.v:413).

## 2. RTL behavior used as the pass criterion

ANCTL.v:150-163 (single consumer chain LOGIC_CENTER -> CENTER1 -> ANCTL):

```systemverilog
wire POL_SW   = POL1_SYNC[1] ^ POL1_SYNC[0]; // pulse on each polarity flip
wire LD_F_ECO = LD_F & ~(R_CS_by_POL & POL_SW);
assign HIZ_NRM1 = (LD_F_ECO | (LD_W <= FAKE target)) ? STB_A_FAKE : STB_A;
```

Fixed background to keep the multiplexer decision driven only by HIZ_SEL:
`LD_F = 1`, `LD_W` not equal to the FAKE target word (bypass path disabled).

Note: the `R_HIZ_SEL` consumers inside CHPI_SD_CTRL.v (L182-197) are commented
out (dead code) and are not covered here.

## 3. Frame configuration (3 frames only)

| frame | LD_F | HIZ_SEL | expected HIZ_NRM1 behavior |
|-------|------|---------|----------------------------|
| 0     | 1    | 0       | equals STB_A_FAKE on every sampled DCLK; POL_SW has no effect |
| 1     | 1    | 1       | equals STB_A only while POL_SW=1; STB_A_FAKE everywhere else |
| 2     | 1    | 0       | restore, identical to frame 0 |

All other cfg fields keep the case defaults; TEST_PRTCT=0x72 must be written
first because HIZ_SEL is a protected register.

## 4. Checker criteria (passive sampling, no RTL-derived golden model)

Sample on posedge DCLK (#1ps skew, same method as the LD_D_OPT checker).

Probes: `u_LOGIC_CENTER.CENTER1.ANCTL` (POL_SW, HIZ_NRM1, LD_F,
STB_A, STB_A_FAKE), `LC_CPUWR` (R_HIZ_SEL, R_LD_F, LSI_PRTECT), and
CHPI_SD_CTRL.DCLK as the sampling clock.

1. Config check (once per frame): LSI_PRTECT=1, R_LD_F=1, R_HIZ_SEL equals
   the frame value (protected write took effect).
2. Primary check, per DCLK sample:
   - SEL=0 frames: `HIZ_NRM1 !== STB_A_FAKE` must never occur.
   - SEL=1 frame: mismatch is allowed only while POL_SW=1, and then
     `HIZ_NRM1 === STB_A`; whenever POL_SW=0 the output must equal
     STB_A_FAKE.
3. Anti-vacuous check: in the SEL=1 frame every active line must show at
   least one POL_SW pulse; a line without one is reported as a stimulus
   error (the primary check would otherwise pass trivially).
4. Restore check: frame 2 shows zero mismatches, identical to frame 0.

## 5. Completion criteria

- At least 3 valid lines per frame.
- Zero errors from all checks above. A protected-write failure (LSI_PRTECT=0)
  is reported as an error, not skipped.

## 6. Known shell issues to fix during implementation

The existing t_8b1lane_HIZ_SEL0 directory is an empty shell:

- vseq body and main_phase are empty (default image sequence only).
- test.f references user_def.sv and waves_dumper.sv which do not exist.
- Not registered in regression/testname.f.

Implementation must add: the toggle sequence (send_CTRLF_seq based cfg
switching, LD_F=1 in every frame, HIZ_SEL per the table), the checker, and the
two missing shell files.

## 7. Non-goals

- STB_A_FAKE internal generation timing (STB_FAKE_ORG_neg chain) - covered by
  the LD/TP timing cases.
- Pad-level analog charge-sharing waveforms; DRA_CS is checked as a digital
  signal, the analog amp behavior behind it is out of scope.
- CSMODE=01/10/11 charge-sharing sources (SMT_CS / register mode) - the case
  pins CSMODE=00 and only verifies the POL_SW mode.
- LD_W FAKE-target bypass path dedicated coverage.
- LD_F=0 scenes: the multiplexer then outputs STB_A regardless of HIZ_SEL, so
  there is nothing HIZ_SEL-specific to observe.
