// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAIScoreVerifier
 * @notice Interface for AI Score Verifier contract
 */
interface IAIScoreVerifier {
    /**
     * @notice Verify AI signature for message score
     * @param contentHash Hash of message content
     * @param length Message length
     * @param aiScore AI intensity score (0-1)
     * @param timestamp Timestamp
     * @param signature AI service signature
     * @return isValid True if signature is valid
     */
    function verifyScore(
        bytes32 contentHash,
        uint256 length,
        uint256 aiScore,
        uint256 timestamp,
        bytes memory signature
    ) external view returns (bool isValid);

    /**
     * @notice Set AI verifier address
     * @param verifier Verifier address
     */
    function setVerifier(address verifier) external;
}
