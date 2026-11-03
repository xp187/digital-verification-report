# PWRC_TA / PWRC_TB 验证计划

## 1. 验证目标

验证 CHIP_SEL=1 时，PWRC_TA[1:0]、PWRC_TB[1:0] 是否正确控制 A、B 两段持续时间，以及 A→B→C 三段对应的 P/N 电流控制码是否正确切换。

只验证数字控制，不测模拟电流大小，不生成 PPM。已实现 case、精简 checker 和独立 Python 生成脚本；完整 UVM/DUT 编译与仿真待服务器执行。

## 2. 规格与预期

PWRC_TA 控制输出开始后的 A 段时间；PWRC_TB 控制紧随其后的 B 段时间。B 段结束后进入 C 段，采用常规 P/N 设置，直到下一次输出。

| 配置 | A 或 B 段时间 |
| --- | --- |
| 00 | 10 packet |
| 01 | 24 packet，默认 |
| 10 | 40 packet |
| 11 | 54 packet |

CHIP_SEL=0 为单段模式，不在本次主测试范围内。

以用户更新的 spec 为准：PWRC_TA/PWRC_TB=00/01/10/11 对应 10/24/40/54 packet。固定 PWRC_TSEL=0，按 1 packet=DCLK/2 换算，checker 的 A/B 期望长度为 5/12/20/27 DCLK。使用同步清零到相位切换的同一端点口径严格比较，不以 RTL 阈值代替规格；若仿真出现边沿计数差异，作为 spec/实现差异报告。

## 3. 测试前提

- 使用现有 8-bit、单 lane 传输，CHIP_SEL=1。
- 配置 CTRLF_CHECKSUM=0101，关闭 checksum 保护，避免配置延迟生效。
- 固定 PWRC_TSEL，记录实际值及其计时倍率。
- PORSD=1，保持正常输出，关闭影响本次观察的省电功能。
- A/B/C 三段使用不同电流控制码：PA=NA=00、PB=NB=01、常规 P=N=11。实现时确认对应 cfg 字段名及常规 P/N 的映射。
- 开启 data_merge、digital、analog checker，关闭 chopper checker。
- 使用正常支持的链路时序，确保最大 A+B 时间能完整结束。不要单纯为延长观察窗口而增大 HFP 或链路频率。

## 4. 八帧激励

| 帧 | TA | TB | 目的 |
| --- | --- | --- | --- |
| 0 | 00 | 01 | A 最小挡 |
| 1 | 01 | 01 | 默认组合 |
| 2 | 10 | 01 | A 第三挡 |
| 3 | 11 | 01 | A 最大挡 |
| 4 | 01 | 00 | B 最小挡 |
| 5 | 01 | 10 | B 第三挡 |
| 6 | 01 | 11 | B 最大挡 |
| 7 | 11 | 00 | 长 A、短 B 组合 |

分别覆盖两个字段的四种编码，不做完整的 16 组合交叉。检查有效区内每个完整周期，不仅每帧抽查一次。

## 5. 观察信号与边界

实现时确认完整实例路径。相关模块为数字顶层下的 ANCTL，以及 LINK_LOGIC.LINK_CONFIG_CTRL.LC_REG_MAPPING。ANCTL.CLK 经 CENTER1 连接到 DCLK。

| 信号 | 用途 |
| --- | --- |
| DCLK、STB_B | 计时时钟及原始输出时序参考 |
| STB_NE | STB_B 下降沿的同步检测信号 |
| PWRC_TIME_CNT | 辅助确认计数器同步清零，不作为独立预期来源 |
| PWRC_TIME[1:0] | A=01、B=10、C=00 |
| PWRC_TA、PWRC_TB、PWRC_TSEL | 实际生效配置 |
| R_BKDU | 仅检查完整处于 R_BKDU=0 正常输出区的周期 |
| R_PWRCP_COP、R_PWRCN_COP | 寄存后的内部 P/N 电流控制输出码 |
| chip_tb_top.u_HK1V11.PWRC_SOP_P、PWRC_SOP_N | 最终送至模拟模块的 P/N 控制端口 |

计时起点为 DCLK 消费 STB_NE 并清零计数器的时钟沿，不能直接使用原始 STB_B 下降沿的时间戳。采样应放在时序更新稳定后。

- A 段起点：本次同步清零时刻。
- A 段终点、B 段起点：PWRC_TIME 从 01 切换到 10。
- B 段终点、C 段起点：PWRC_TIME 从 10 切换到 00。
- A 长度：同步起点到 A→B；B 长度：A→B 到 B→C。
- 不要仅等待 PWRC_TIME[0] 上升沿识别 A 起点，因为计数器清零时它可能已经为高。
- 最终 P/N 控制码在阶段选择之后还经过一级 DCLK 寄存，检查时明确考虑这一级延迟。

## 6. 精简 checker 方案

采用一个逐周期检查流程，加一张四挡规格时间表，不引入通用 scoreboard 框架、寄存器数据库或复杂恢复机制。

1. 在 R_BKDU=0 的同步起点锁存 TA/TB/TSEL，并确认与已被 CTRL_F 接收的配置一致。预期配置按 CTRL_F 实际接收时机推进，不能仅跟随视频帧计数：K4+CTRL_F 可能在上一帧 VBP 内修改寄存器。
2. 记录起点、A→B、B→C 的 DCLK 序号，检查顺序必须为 A→B→C，完整周期内不能跳段或重复进入某段。
3. 根据确认后的 T 定义及固定 TSEL，把规格时间转换为 DCLK 数，分别比较 A、B 长度。使用整数边沿计数，明确端点口径，不加宽泛容差，也不把 DUT 内部阈值当作期望值。
4. 在已知寄存延迟后，同时检查三段内部 P/N 输出码与最终 PWRC_SOP_P/N。最终端口直接与阶段预期码比较，不与内部实际值自比较，覆盖输出连接错误。PA/NA=00 对应 010，PB/NB=01 对应 100；常规 P/N=11 的期望码按其规格映射确认。
5. 检查独立性：帧 0～3 的 B 段长度应相同；帧 1/4/5/6 的 A 段长度应相同。改变 TA 可以移动 B 起点，但不能改变 B 自身长度。
6. 只跳过被复位、BKDU 切换或相关配置更新打断的周期，并报告跳过情况。每帧配置至少完成一次有效检查，避免全部跳过仍判通过。

日志仅保留失败信息和各配置最终检查次数。时间失败信息包含 TA/TB、实测 DCLK 数和期望 DCLK 数。

八帧发送完成且最后一次完整检查结束后，沿用现有 objection 流程退出，不等待第九帧。

## 7. 规格映射与计数边界

按新 spec，10/24/40/54 packet 换算为 5/12/20/27 DCLK。当前 RTL 的 A_NUM/B_NUM 也映射到 5/12/20/27，但比较条件包含等号，且计数器在 STB_NE 同步清零；checker 仍以同步起点到实际 PWRC_TIME 相位切换的测量值与 spec 换算值比较，不从 RTL 阈值推导期望，也不自动增加一拍。若仿真出现一拍差异，应根据波形确认 spec 的时间起止口径或 RTL 行为。

当前本地源码证据：

- cmodel/test/HV2A31/HK1V11_digital_top/seperated_code/ANCTL.v:206：字段映射为 5/12/20/27。
- ANCTL.v:237：计数使用 CNT >> (2 * PWRC_TSEL)。
- ANCTL.v:239：A 段条件为 CNT_FINAL <= A_NUM；B 段条件为 A_NUM < CNT_FINAL <= A_NUM+B_NUM。
- LC_REG_MAPPING.v:325：CHIP_SEL=1 且处于正常输出时，根据 PWRC_TIME 选择 PA/NA、PB/NB 或常规 P/N。


## 8. 通过条件与当前状态

- 两个字段的 00/01/10/11 均有完整有效区测量。
- A/B 长度、阶段顺序、P/N 控制码及字段独立性全部通过。
- CTRL_F/帧交接处不使用过期的帧级预期。
- 通用 checker 保持开启，八帧后仿真正常结束。
- 已生成 case 与 checker，登记 regression/testname.f；Python 语法、配置、信号引用及生成一致性检查通过，未执行完整 UVM/DUT 编译或仿真。

## 9. 脚本与使用

脚本：`E:\projects\HK1V11_top_1012\generate_t_8b1lane_PWRC_TA_TB.py`。

```bash
python3 generate_t_8b1lane_PWRC_TA_TB.py --dv-top /path/to/DV_TCON_C/top
```

更新已有生成文件时加 `--overwrite`。脚本保留本计划，生成 cfg_frame0～8，最后一份重复帧7配置作为结束保护；实际仍发送8帧图像。

生成器不创建或复制 PPM，服务器须提供或链接已有 `t_8b1lane/pattern/frame_0.ppm`～`frame_7.ppm`。本地基础 pattern 缺失，完整图像传输与通用 checker 待服务器执行。
