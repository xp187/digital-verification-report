# PORSD 验证计划

## 目标

验证 `0x01[5] PORSD` 的 Source Driver 复位与恢复：`0` 为复位模式，规格要求 SD 输出短接 VCOM；`1` 为正常模式。数字侧重点检查复位时的输出控制及恢复后的正常输出。实际模拟输出是否短接 VCOM，只有模拟模型可观测时才能进一步确认，不能仅凭数字控制信号宣称通过。

依据：寄存器说明；当前 RTL `LC_CPUWR.v:312,892-963`、`ANCTL.v:136-165,183-189`。`PORSD` 上电默认 0，复位域为 `RSTN`。旧 `t_8b1lane_PORSD0` 八个数据帧均写 0，没有专用功能 checker，仅作为单 lane case 配置参考。

## 激励配置

新 case 使用 8 个数据帧、每帧 16 条活动行，保持其他时序及输出配置不变，`TEST_PRTCT=0x72`。`PORSD` 按配置帧设置为 `0,0,1,1,0,0,1,1`；前两档确认复位，中间与末尾分别验证释放、重新复位、再次恢复。结束保护配置继续写 1。

每帧显式设置 `CTRLF_CHECKSUM=0101`：当前 RTL 在低四位为 `4'h5` 时关闭 `chksum_mode`，使 `0x01[5]` 直接随配置写入，避免 checksum 的 shadow/延迟装载改变本 case 的逐帧预期。保持 `XON=1`、`POFF_DRA_AMP=0`，关闭会额外拉高 `CS_VCOM` 的 VPS 模式；每档只在配置稳定的活动行取样。配置帧编号与图像帧的对应关系以实际发送的 `K4+CTRL_F` 为准。

## 检查点

1. 在 `K4+CTRL_F` 写入后建立该档期望值；进入随后的稳定活动行时，先检查 `R_PORSD` 等于该期望值，再检查输出。寄存器可能在前一图像帧的 VBP 阶段已更新，不按图像帧号推断其旧值；也不能只按实际 `R_PORSD` 分支，否则写入未生效会漏报。
2. `PORSD=0`：`HIZ_SRC1/2=1`、`HSR_DRA=0`、`DRA_CS=1`、`CS_VCOM=1`；`POL1A/B` 至 `POL4A/B` 均为 0。上述期望以 `POFF_DRA_AMP=0` 为前提。复位档不做正常像素输出比较。
3. `PORSD=1`：在 `XON=1` 且 VPS 已关闭时检查 `CS_VCOM=0`。当 `CS_START=0` 且对应的 `HIZ_NRM1/2=0` 时，检查该组 `HIZ_SRC1/2=0` 和对应 POL A/B 互补；两组 Hi-Z 路径都要取得有效样本。不能要求 `DRA_CS` 或 `HSR_DRA` 在所有正常周期恒为固定值。
4. 复位和正常档均须取得稳定活动行样本；正常档两组 Hi-Z 路径均须覆盖。任一档没有样本、预期 `R_PORSD` 不符或输出控制不符即失败。checker 只保留预期档位、条件判断、样本数和错误数，不复制通用数据 scoreboard。

## 实现与验证边界

本 case 开启 data_merge、digital、analog 三个 checker。analog 从首个 `dm_VS` 启动，采集 SIM_OUT 时同步记录实际 `R_PORSD`；PORSD=0 时检查有效通道的完整 10-bit 值为 `10'h088`，PORSD=1 时沿用正常比较。pixel 按行保存 PORSD，保留行帧计数和队列清理，避免帧末 CTRL_F 更新造成误判。独立 PORSD checker 继续检查计划值与实际寄存器及控制输出。

实现时优先观察 `ANCTL` 现有信号和顶层对应输出；服务器实际 RTL 层级须在编译前核对。先用固定 0/1 激励验证 checker 正例，再故意翻转一项预期控制信号做反例，之后运行完整 DUT 仿真。若模拟模型提供 SD 输出与 VCOM 电位，再加模拟侧短接检查；没有该模型时，结论限定为数字控制正确。

## 实现状态

已生成 `t_8b1lane_PORSD.sv`、`porsd_checker.sv`、`cfg_frame0..8.txt` 及 case 配置文件，并登记到 `regression/testname.f`。未生成或复制 PPM；当前工程副本也没有 `tests/t_8b1lane/pattern`，运行仿真前需提供已有的 `frame_*.ppm`。尚未编译或运行 DUT 仿真，模拟侧 SD 与 VCOM 短接仍不在数字 checker 的结论范围内。
