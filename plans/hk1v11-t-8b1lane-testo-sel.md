# R_TESTO_SEL 验证计划（真实SEL生效时检查对应源）

## 1. 范围

SEL=00～3F，每组由CHPI真实写入后，保持其实际R_TESTO_SEL/MONISEL，再force该组源并检查digital_top的{TESTO_O4,TESTO_O3,TESTO_O2,TESTO_O1}。checker不force MONISEL或R_TESTO_SEL。TEST2=1、TESTO_EN_OPT=0、PWRC_TSEL=0、TEST_PRTCT=72、CTRLF_CHECKSUM=0101；TEST12保留EOL接线。

## 2. 逐组流程

每组先正常训练、LSP及CHPI CTRL_F；checker检查0x20 payload、0x30密码、有效R_TESTO_SEL与MONISEL。sender发完完整CTRL_F及K2/32个编码零数据packet后触发TX_READY。checker此时才force本组全部源为0、逐源为1再回0、最后全部为1；每步5ns后核对实际源及四路最终数字输出。只用固定映射和预定force值产生期望，不从DUT输出反推。完成后release全部源和辅助OE/HP/POFF控制，触发CHECKED。等待checker时sender继续发完整维护块；下一组开始前再发16个完整维护块，使probe后的延迟失锁先显现。若LOCK为低，采用已有driver的稳定重锁路径：持续发训练直到LOCK重新为高并保持4us；若保持高则直接LSP/配置。避免普通训练在“进入时LOCK高、发送4us过程中变低”时仍退出的竞态。

全部123个去重后的非固定源位保留显式force0/force1/release。常量位必须保持0、同源重复位共享激励。只有实际源、最终输出和OE均正确的样本才累计0/1覆盖；真实CHPI配置和该组探针都正确才置完成位。5ms总超时报告卡住的SEL和已完成mask。

SEL=01的LSI_PRTECT是0x20选择值的保护条件。RTL规定LSI_PRTECT=0时R_TESTO_SEL回退00，因此不能同时要求“选择仍是01”和“LSI_PRTECT=0传到TESTO4”。该位force0时专门核对选择回退00，release后核对恢复01；在01组保持LSI_PRTECT=1，检查TESTO4=1，其他三路分别检查0/1。此回退不算01组TESTO4的0覆盖；TESTO3对应BWDBL_PHY_RSTN。

SEL=0E的LITEST和I_POFF_MODE同网，LITEST=1时OE期望为0，内部digital_top的TESTO四路数据仍需与源一致；不额外force POFF。其他组固定POFF=0、OE=1。MON_OUT_OE和HIGH_PEAKING_SEL1仅作输出路径条件控制，不force最终TESTO数据或最终OE。

## 3. RTL映射

| SEL | 期望向量 `[3:0]` |
| :---: | --- |
| 00 | `{R_POL, R_FSYNC, RECK0, STB_IO}` |
| 01 | `{LSI_PRTECT, BWDBL_PHY_RSTN, N_RST_NLOCK, RECK0}` |
| 02 | `{K4_FIND, K3_FIND, K2_FIND, K1_FIND}` |
| 03 | `{1'b0, SCREN_SYNC_K3, R_SCREN, 1'b0}` |
| 04 | `{KEY_SHIFT_JUDGE1, KEY_SHIFT_JUDGE0, HSR_ACTIVE, 1'b0}` |
| 05 | `{R_FSYNC, K3_FIND, K2_FIND, R_BKDU}` |
| 06 | `{K4_FIND, R_FSYNC, STB_B, STB_A}` |
| 07 | `{N_RST_PHY, TEST_EN, LOCK_FREQ, OSC_CLK}` |
| 08 | `{DATA_POINT_LAT[11], DATA_POINT_LAT[1], DATA_POINT_LAT[10], DATA_POINT_LAT[0]}` |
| 09 | `{DATA_POINT_LAT[13], DATA_POINT_LAT[3], DATA_POINT_LAT[12], DATA_POINT_LAT[2]}` |
| 0A | `{DATA_POINT_LAT[15], DATA_POINT_LAT[5], DATA_POINT_LAT[14], DATA_POINT_LAT[4]}` |
| 0B | `{DATA_POINT_LAT[17], DATA_POINT_LAT[7], DATA_POINT_LAT[16], DATA_POINT_LAT[6]}` |
| 0C | `{DATA_POINT_LAT[19], DATA_POINT_LAT[9], DATA_POINT_LAT[18], DATA_POINT_LAT[8]}` |
| 0D | `{BWDL_TRIG, BWDA_TRIG, BWDB_TRIG, BWDBL_TRIG}` |
| 0E | `{LITEST, LOCK_IN_RST_TRIG, UTC_ERR, UTC_FRM_ERR}` |
| 0F | `{AUTO_EQ_PHY_RSTN, CDR_CRC_DET_RST_REQ, rx_vcom_detect, FRAME_WR_FLAG}` |
| 10 | `{UTC_FRM_CNT[4], UTC_CNT[2], UTC_CNT[1], UTC_CNT[0]}` |
| 11 | `{UTC_FRM_CNT[3], UTC_FRM_CNT[2], UTC_FRM_CNT[1], UTC_FRM_CNT[0]}` |
| 12 | `{HEADER_ERROR_LINE_CNT[3], HEADER_ERROR_LINE_CNT[2], HEADER_ERROR_LINE_CNT[1], HEADER_ERROR_LINE_CNT[0]}` |
| 13 | `{1'b0, HEADER_ERROR_FRAME_CNT[4], LONG01_ERROR_FRAME_CNT[5], LONG01_ERROR_FRAME_CNT[4]}` |
| 14 | `{HEADER_ERROR_FRAME_CNT[3], HEADER_ERROR_FRAME_CNT[2], HEADER_ERROR_FRAME_CNT[1], HEADER_ERROR_FRAME_CNT[0]}` |
| 15 | `{LONG01_ERROR_FRAME_CNT[3], LONG01_ERROR_FRAME_CNT[2], LONG01_ERROR_FRAME_CNT[1], LONG01_ERROR_FRAME_CNT[0]}` |
| 16 | `{DRA_ACS_DATA, DRA_ACS_POL, DRA_CS, DRA_CHOP}` |
| 17 | `{DRD_XRST, DRD_XRST, LENB_R, LENB_L}` |
| 18 | `{SRA, SRB, SLA, SLB}` |
| 19 | `{FYSAR, FYSBR, FYSAL, FYSBL}` |
| 1A | `{line_has_non0, zero_line_cnt[1], zero_line_cnt[0], two_zero_line}` |
| 1B | `{1'b0, de, cnt_flag, flag_det}` |
| 1C | `{bus10_rdata[3], bus10_rdata[2], bus10_rdata[1], bus10_rdata[0]}` |
| 1D | `{bcc_in_data, bcc_receive_state[2], bcc_receive_state[1], bcc_receive_state[0]}` |
| 1E | `{bcc_out_data, bcc_cmd_state[2], bcc_cmd_state[1], bcc_cmd_state[0]}` |
| 1F | `{bcc_receive_valid, bcc_input_rise_edge, bcc_input_fall_edge, start_training}` |
| 20 | `{training_valid, rx_vcom_detect, training_result, AUTO_EQ_PERIOD}` |
| 21 | `{reg_lane_ctrl[3], reg_lane_ctrl[2], reg_lane_ctrl[1], reg_lane_ctrl[0]}` |
| 22～3F | 默认组：`{R_POL, R_FSYNC, RECK0, STB_IO}` |




RECK0为LC_MONBLOCK内部DCLK_DIV[3]；BWDBL_TRIG作为实际MUX源独立force。SEL16及SEL0F按用户提供的新版RTL截图，本地旧DUT不修改。

## 4. 交付和验证

FRAME_NUM=1、DV=0仅满足公共静态数组，实际无视频帧、PPM、Cmodel或ctrl_l_line_cfg.txt。提供同步的Python3.9独立安装器；校对代码、映射、force/release及握手，隔离目录重复安装。完整SV/UVM编译、真实force及每组失锁恢复需新版服务器RTL仿真确认。SEL01的0值验证RTL保护回退，不宣称01组MUX的LSI_PRTECT低电平透传。
